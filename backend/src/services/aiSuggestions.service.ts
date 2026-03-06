import * as Sentry from "@sentry/node";
import { zodTextFormat } from "openai/helpers/zod";
import { SyncPrerecordedResponse } from "@deepgram/sdk";
import {
  ClipSuggestionsSchema,
  MultipleClipSuggestionsSchema,
  ClipSuggestions,
  ClipSegment,
  BatchClipSuggestions,
  MultipleBatchClipSuggestionsSchema,
} from "../types/ai.types";
import z from "zod";
import { generatePrompt, generateBatchPrompt } from "../config/prompts";
import fs from "fs";
import { PromptType } from "../constants/promptTypes";
import {
  getGeminiClient,
  getGeminiHelpers,
  uploadVideoToGemini,
  cleanupGeminiResources,
} from "./ad-clone/gemini.service";
import { openaiClient as client } from "./openai.service";

/**
 * Detects if AI returned timestamps in M.SS format (e.g. 1.24 = 1min 24sec)
 * instead of pure seconds, and converts them.
 */
function convertMSStoSeconds(val: number): number {
  const minutes = Math.floor(val);
  const fractionalSeconds = Math.round((val - minutes) * 100);
  return minutes * 60 + fractionalSeconds;
}

function normalizeClipTimestamps(clips: ClipSuggestions[]): ClipSuggestions[] {
  for (const clip of clips) {
    const allSegments: ClipSegment[] = [
      ...(clip.hook ? [clip.hook] : []),
      ...clip.main,
    ];
    if (allSegments.length === 0) continue;

    // Check if ALL segments have duration < 2s — strong sign of M.SS format
    const allTooShort = allSegments.every(
      (s) => s.end - s.start < 2
    );
    if (!allTooShort) continue;

    console.log("[ClipNormalize] Detected M.SS timestamp format, converting to seconds");
    for (const seg of allSegments) {
      const oldStart = seg.start;
      const oldEnd = seg.end;
      seg.start = convertMSStoSeconds(seg.start);
      seg.end = convertMSStoSeconds(seg.end);
      console.log(
        `[ClipNormalize] ${oldStart} → ${seg.start}s, ${oldEnd} → ${seg.end}s (duration: ${(seg.end - seg.start).toFixed(1)}s)`
      );
    }
  }
  return clips;
}

export interface ClipGenerationOptions {
  length?: number;
  hookLength?: number;
  promptType?: PromptType;
  customPrompt?: string;
  textPrompt?: string;
  numberOfVideos?: number;
  videoPath?: string;
  headingInstructions?: string;
  videoDuration?: number;
}

export const generateClipSuggestionsService = async (
  transcription: SyncPrerecordedResponse | null,
  options: ClipGenerationOptions = {},
): Promise<ClipSuggestions[]> => {
  const length = options.length || 40;
  const hookLength = options.hookLength || 6;
  const promptType = options.promptType || "business";
  const numberOfVideos = options.numberOfVideos || 1;

  const transcriptText = transcription
    ? transcription.results.channels[0].alternatives[0].transcript
    : "";
  const transcriptObject = transcription
    ? JSON.stringify(transcription.results.channels[0].alternatives[0].paragraphs)
    : "";

  // Compute video duration from transcript (last word end time) or from options
  let videoDuration = options.videoDuration;
  if (!videoDuration && transcription) {
    const words = transcription.results.channels[0].alternatives[0].words;
    if (words && words.length > 0) {
      videoDuration = words[words.length - 1].end;
    }
  }

  const prompt = generatePrompt(
    promptType,
    {
      length,
      hookLength,
      videoDuration,
      transcriptText,
      transcriptObject,
      numberOfVideos,
      userTextPrompt: options.textPrompt,
      headingInstructions: options.headingInstructions,
    },
    options.customPrompt,
  );

  if (promptType === "gaming" || promptType === "general" || promptType === "viral") {
    const googleClient = await getGeminiClient();
    const { createUserContent, createPartFromUri, ThinkingLevel } =
      await getGeminiHelpers();

    let contents: any;
    let uploadedFileName: string | null = null;
    let reEncodedPath: string | null = null;

    if (options.videoPath && fs.existsSync(options.videoPath)) {
      const uploadResult = await uploadVideoToGemini(options.videoPath);
      uploadedFileName = uploadResult.file.name;
      reEncodedPath = uploadResult.reEncodedPath;

      contents = createUserContent([
        createPartFromUri(uploadResult.file.uri, uploadResult.file.mimeType),
        prompt,
      ]);
    } else {
      console.log("No video path provided, using transcript only");
      contents = prompt;
    }

    const parseGeminiResponse = (text: string): ClipSuggestions[] => {
      const jsonResponse = MultipleClipSuggestionsSchema.parse(JSON.parse(text));

      let videos: any[] = [];
      if (jsonResponse.videos && Array.isArray(jsonResponse.videos)) {
        videos = jsonResponse.videos;
      } else if (Array.isArray(jsonResponse)) {
        videos = jsonResponse;
      } else {
        throw new Error("Unexpected Gemini response format");
      }

      const validVideos = videos.filter((v: any) => {
        if (!v || typeof v !== "object") {
          console.error("Invalid video entry (not an object):", v);
          return false;
        }
        // Hook is now optional — only validate if present
        if (v.hook && (typeof v.hook.start !== "number" || typeof v.hook.end !== "number")) {
          console.error("Invalid video entry (hook has bad start/end):", v);
          return false;
        }
        if (!Array.isArray(v.main) || v.main.length === 0) {
          console.error("Invalid video entry (main is not an array or empty):", v);
          return false;
        }
        return true;
      });

      if (validVideos.length === 0) {
        throw new Error("No valid videos in Gemini response");
      }
      return normalizeClipTimestamps(validVideos);
    };

    // Try Gemini Pro
    let geminiResult: ClipSuggestions[] | null = null;

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

      geminiResult = parseGeminiResponse(response.text);
      console.log("AI Gemini Pro Clip Suggestions Response:", geminiResult);
    } catch (error) {
      console.warn("Gemini Pro failed, trying Gemini Flash...", error);
      Sentry.captureException(error);
    }

    // Try Gemini Flash if Pro failed
    if (!geminiResult) {
      try {
        const response = await googleClient.models.generateContent({
          model: "gemini-3-flash-preview",
          contents,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(MultipleClipSuggestionsSchema),
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        });

        geminiResult = parseGeminiResponse(response.text);
        console.log("AI Gemini Flash Clip Suggestions Response:", geminiResult);
      } catch (error) {
        console.warn("Gemini Flash fallback failed:", error);
        Sentry.captureException(error);
      }
    }

    await cleanupGeminiResources(reEncodedPath, uploadedFileName);

    if (geminiResult) {
      return geminiResult;
    }

    // Fall through to OpenAI path below (transcript-only, no video)
    console.log("All Gemini models failed, using OpenAI fallback for clip suggestions");
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
          "multiple_clip_suggestions",
        ),
      },
    });
    console.log(
      "AI Multiple Clip Suggestions Response:",
      response.output_parsed,
    );
    return normalizeClipTimestamps(response.output_parsed?.videos || []);
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
    return normalizeClipTimestamps(response.output_parsed ? [response.output_parsed] : []);
  }
};

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
  options: BatchClipGenerationOptions,
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
      bt.transcription.results.channels[0].alternatives[0].paragraphs,
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
    })),
  );

  // Compute max video duration across all batch transcripts
  let videoDuration = options.videoDuration;
  if (!videoDuration) {
    for (const bt of options.batchTranscripts) {
      const words = bt.transcription.results.channels[0].alternatives[0].words;
      if (words && words.length > 0) {
        const endTime = words[words.length - 1].end;
        if (!videoDuration || endTime > videoDuration) videoDuration = endTime;
      }
    }
  }

  // Generate batch-aware prompt
  const prompt = generateBatchPrompt(
    promptType,
    {
      length,
      hookLength,
      videoDuration,
      transcriptText: combinedTranscriptText,
      transcriptObject: combinedTranscriptObject,
      numberOfVideos,
      userTextPrompt: options.textPrompt,
      headingInstructions: options.headingInstructions,
      isBatch: true,
      batchTranscripts: batchTranscriptData,
    },
    options.customPrompt,
  );

  console.log(
    "Generating batch clip suggestions for",
    options.batchTranscripts.length,
    "videos",
  );
  if (promptType === "gaming" || promptType === "general") {
    console.log(
      "Note: Batch mode for gaming/general uses transcript analysis only (no video upload)",
    );
  }
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
        "batch_clip_suggestions",
      ),
    },
  });

  console.log("AI Batch Clip Suggestions Response:", response.output_parsed);
  return normalizeClipTimestamps(response.output_parsed?.videos || []) as BatchClipSuggestions[];
};
