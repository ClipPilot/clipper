import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ENV } from "../config/env";
import { SyncPrerecordedResponse } from "@deepgram/sdk";
import {
  ClipSuggestionsSchema,
  MultipleClipSuggestionsSchema,
  ClipSuggestions,
} from "../types/ai.types";
import z from "zod";
import { generatePrompt } from "../config/prompts";
import fs from "fs";
import { PromptType } from "../constants/promptTypes";

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

  if (promptType === "gaming") {
    const googleClient = await getGoogleClient();

    let contents: any;

    if (options.videoPath && fs.existsSync(options.videoPath)) {
      console.log("Uploading video to Gemini for analysis...");
      let uploadedFile = await googleClient.files.upload({
        file: options.videoPath,
        config: { mimeType: "video/mp4" },
      });
      console.log(
        "Video uploaded to Gemini:",
        uploadedFile.name,
        "State:",
        uploadedFile.state
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
        throw new Error("Gemini failed to process the video file");
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

    try {
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
