import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ENV } from "../config/env";
import { SyncPrerecordedResponse } from "@deepgram/sdk";
import {
  ClipSuggestionsSchema,
  MultipleClipSuggestionsSchema,
  ClipSuggestions,
} from "../types/ai.types";
import { generatePrompt } from "../config/prompts";

const client = new OpenAI({
  apiKey: ENV.OPENAI_API_KEY,
  timeout: 10 * 60 * 1000,
  maxRetries: 3,
});

export interface ClipGenerationOptions {
  length?: number;
  hookLength?: number;
  promptType?: "business" | "viral";
  customPrompt?: string;
  textPrompt?: string;
  numberOfVideos?: number;
}

export const generateClipSuggestionsService = async (
  transcription: SyncPrerecordedResponse,
  options: ClipGenerationOptions = {}
): Promise<ClipSuggestions[]> => {
  // Default values
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

  // If requesting multiple videos, use the MultipleClipSuggestionsSchema
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
    // Single video - use original schema
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
