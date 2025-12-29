import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ENV } from "../config/env";
import { SyncPrerecordedResponse } from "@deepgram/sdk";
import {
  ClipSuggestionsSchema,
  MultipleClipSuggestionsSchema,
  ClipSuggestions,
  BatchClipSuggestions,
  MultipleBatchClipSuggestionsSchema,
} from "../types/ai.types";
import z from "zod";
import { generatePrompt, generateBatchPrompt } from "../config/prompts";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { PromptType } from "../constants/promptTypes";

/**
 * Re-encode video to H.264 for Gemini compatibility
 * Gemini often fails with HEVC/H.265 or other codecs
 */
async function reencodeForGemini(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.mp4$/, "_gemini.mp4");

  console.log("Re-encoding video to H.264 for Gemini compatibility...");

  // Use ffmpeg to re-encode to H.264 with reasonable quality
  // -c:v libx264 - use H.264 codec
  // -preset fast - balance between speed and compression
  // -crf 23 - reasonable quality (18-28 range, lower = better)
  // -c:a aac - re-encode audio to AAC
  // -movflags +faststart - optimize for streaming
  execSync(
    `ffmpeg -y -i "${inputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -movflags +faststart "${outputPath}"`,
    { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 }
  );

  const stats = fs.statSync(outputPath);
  console.log("Re-encoded video size:", (stats.size / 1024 / 1024).toFixed(2), "MB");

  return outputPath;
}

const client = new OpenAI({
  apiKey: ENV.OPENAI_API_KEY,
  timeout: 10 * 60 * 1000,
  maxRetries: 3,
});
let googleClient: any = null;
let createUserContent: any = null;
let createPartFromUri: any = null;

const getGoogleClient = async () => {
  if (!googleClient) {
    const genai = await import("@google/genai");
    googleClient = new genai.GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
    createUserContent = genai.createUserContent;
    createPartFromUri = genai.createPartFromUri;
  }
  return googleClient;
};

export interface ClipGenerationOptions {
  length?: number;
  hookLength?: number;
  promptType?: PromptType;
  customPrompt?: string;
  textPrompt?: string;
  numberOfVideos?: number;
  videoPath?: string;
}

export const generateClipSuggestionsService = async (
  transcription: SyncPrerecordedResponse,
  options: ClipGenerationOptions = {}
): Promise<ClipSuggestions[]> => {
  const length = options.length || 40;
  const hookLength = options.hookLength || 6;
  const promptType = options.promptType || "business";
  const numberOfVideos = options.numberOfVideos || 1;

  const transcriptText =
    transcription.results.channels[0].alternatives[0].transcript;
  const transcriptObject = JSON.stringify(
    transcription.results.channels[0].alternatives[0].paragraphs
  );

  const prompt = generatePrompt(
    promptType,
    {
      length,
      hookLength,
      transcriptText,
      transcriptObject,
      numberOfVideos,
      userTextPrompt: options.textPrompt,
    },
    options.customPrompt
  );

  if (promptType === "gaming" || promptType === "general") {
    const googleClient = await getGoogleClient();

    let contents: any;

    let uploadedFileName: string | null = null;
    let reEncodedPath: string | null = null;

    if (options.videoPath && fs.existsSync(options.videoPath)) {
      console.log("Uploading video to Gemini for analysis...");
      const fileStats = fs.statSync(options.videoPath);
      console.log("Original video file size:", (fileStats.size / 1024 / 1024).toFixed(2), "MB");

      // Re-encode to H.264 for Gemini compatibility
      reEncodedPath = await reencodeForGemini(options.videoPath);

      let uploadedFile = await googleClient.files.upload({
        file: reEncodedPath,
        config: { mimeType: "video/mp4" },
      });
      uploadedFileName = uploadedFile.name;
      console.log(
        "Video uploaded to Gemini:",
        uploadedFile.name,
        "State:",
        uploadedFile.state,
        "Size bytes:",
        uploadedFile.sizeBytes
      );

      // Wait for file to become ACTIVE (processing can take time for videos)
      while (uploadedFile.state === "PROCESSING") {
        console.log("Waiting for Gemini to process video...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        uploadedFile = await googleClient.files.get({
          name: uploadedFile.name,
        });
        console.log("File state:", uploadedFile.state);
      }

      if (uploadedFile.state === "FAILED") {
        console.error("Gemini file processing failed:", JSON.stringify(uploadedFile, null, 2));
        // Clean up re-encoded file
        if (reEncodedPath && fs.existsSync(reEncodedPath)) {
          fs.unlinkSync(reEncodedPath);
        }
        // Delete failed file from Gemini
        try {
          await googleClient.files.delete({ name: uploadedFileName });
          console.log("Deleted failed file from Gemini:", uploadedFileName);
        } catch (e) {
          console.error("Failed to delete Gemini file:", e);
        }
        throw new Error(`Gemini failed to process the video file: ${uploadedFile.error?.message || uploadedFile.statusText || "Unknown error"}`);
      }

      console.log("Video ready for analysis");

      contents = createUserContent([
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        prompt,
      ]);
    } else {
      console.log("No video path provided, using transcript only");
      contents = prompt;
    }

    const { ThinkingLevel } = await import("@google/genai");

    try {
      const response = await googleClient.models.generateContent({
        model: "gemini-3-pro-preview",
        contents,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(MultipleClipSuggestionsSchema),
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      const jsonResponse = MultipleClipSuggestionsSchema.parse(
        JSON.parse(response.text)
      );
      console.log("AI Gemini Clip Suggestions Response:", jsonResponse);

      let videos: any[] = [];
      if (jsonResponse.videos && Array.isArray(jsonResponse.videos)) {
        videos = jsonResponse.videos;
      } else if (Array.isArray(jsonResponse)) {
        videos = jsonResponse;
      } else {
        console.error("Unexpected Gemini response format:", jsonResponse);
        return [];
      }

      const validVideos = videos.filter((v: any) => {
        if (!v || typeof v !== "object") {
          console.error("Invalid video entry (not an object):", v);
          return false;
        }
        if (
          !v.hook ||
          typeof v.hook.start !== "number" ||
          typeof v.hook.end !== "number"
        ) {
          console.error(
            "Invalid video entry (missing hook with start/end):",
            v
          );
          return false;
        }
        if (!Array.isArray(v.main)) {
          console.error("Invalid video entry (main is not an array):", v);
          return false;
        }
        return true;
      });

      if (validVideos.length === 0) {
        console.error("No valid videos in Gemini response");
        return [];
      }

      return validVideos;
    } catch (error) {
      console.error("Failed to parse Gemini response:", error);
      return [];
    } finally {
      // Cleanup: delete re-encoded file and Gemini upload
      if (reEncodedPath && fs.existsSync(reEncodedPath)) {
        fs.unlinkSync(reEncodedPath);
        console.log("Deleted re-encoded temp file:", reEncodedPath);
      }
      if (uploadedFileName) {
        try {
          await googleClient.files.delete({ name: uploadedFileName });
          console.log("Deleted file from Gemini:", uploadedFileName);
        } catch (e) {
          console.error("Failed to delete Gemini file:", e);
        }
      }
    }
  }

  if (numberOfVideos > 1) {
    const response = await client.responses.parse({
      model: "gpt-5-mini",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: zodTextFormat(
          MultipleClipSuggestionsSchema,
          "multiple_clip_suggestions"
        ),
      },
    });
    console.log(
      "AI Multiple Clip Suggestions Response:",
      response.output_parsed
    );
    return response.output_parsed?.videos || [];
  } else {
    const response = await client.responses.parse({
      model: "gpt-5-mini",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: zodTextFormat(ClipSuggestionsSchema, "clip_suggestions"),
      },
    });
    console.log("AI Clip Suggestions Response:", response.output_parsed);
    return response.output_parsed ? [response.output_parsed] : [];
  }
};

// Batch clip generation options
export interface BatchClipGenerationOptions extends ClipGenerationOptions {
  batchTranscripts: Array<{
    videoIndex: number;
    transcription: SyncPrerecordedResponse;
    fileName?: string;
  }>;
}

/**
 * Generate clip suggestions from multiple source videos
 * AI can select the best hook from any video and mix segments from all videos
 */
export const generateBatchClipSuggestionsService = async (
  options: BatchClipGenerationOptions
): Promise<BatchClipSuggestions[]> => {
  const length = options.length || 40;
  const hookLength = options.hookLength || 6;
  const promptType = options.promptType || "business";
  const numberOfVideos = options.numberOfVideos || 1;

  // Prepare batch transcript data with video indexes
  const batchTranscriptData = options.batchTranscripts.map((bt) => ({
    videoIndex: bt.videoIndex,
    transcriptText:
      bt.transcription.results.channels[0].alternatives[0].transcript,
    transcriptObject: JSON.stringify(
      bt.transcription.results.channels[0].alternatives[0].paragraphs
    ),
    fileName: bt.fileName,
  }));

  // Create combined transcript text for context (used in base prompt)
  const combinedTranscriptText = batchTranscriptData
    .map((bt) => `[VIDEO ${bt.videoIndex + 1}]: ${bt.transcriptText}`)
    .join("\n\n---\n\n");

  const combinedTranscriptObject = JSON.stringify(
    batchTranscriptData.map((bt) => ({
      videoIndex: bt.videoIndex,
      paragraphs: JSON.parse(bt.transcriptObject),
    }))
  );

  // Generate batch-aware prompt
  const prompt = generateBatchPrompt(
    promptType,
    {
      length,
      hookLength,
      transcriptText: combinedTranscriptText,
      transcriptObject: combinedTranscriptObject,
      numberOfVideos,
      userTextPrompt: options.textPrompt,
      isBatch: true,
      batchTranscripts: batchTranscriptData,
    },
    options.customPrompt
  );

  console.log("Generating batch clip suggestions for", options.batchTranscripts.length, "videos");

  // For gaming prompt type with video analysis, we'd need to handle multiple videos
  // For now, batch mode uses transcript-only analysis for all prompt types
  if (promptType === "gaming" || promptType === "general") {
    console.log("Note: Batch mode for gaming/general uses transcript analysis only (no video upload)");
  }

  // Always use multiple suggestions schema for batch since we want sourceVideoIndex
  const response = await client.responses.parse({
    model: "gpt-5-mini",
    reasoning: { effort: "medium" },
    input: [
      {
        role: "user",
        content: prompt,
      },
    ],
    text: {
      format: zodTextFormat(
        MultipleBatchClipSuggestionsSchema,
        "batch_clip_suggestions"
      ),
    },
  });

  console.log("AI Batch Clip Suggestions Response:", response.output_parsed);
  return response.output_parsed?.videos || [];
};
