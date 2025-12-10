import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ENV } from "../config/env";
import { SyncPrerecordedResponse } from "@deepgram/sdk";
import { ClipSuggestionsSchema } from "../types/ai.types";
import { generatePrompt } from "../config/prompts";

const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

export interface ClipGenerationOptions {
  length?: number;
  hookLength?: number;
  promptType?: "business" | "viral";
  customPrompt?: string;
}

export const generateClipSuggestionsService = async (
  transcription: SyncPrerecordedResponse,
  options: ClipGenerationOptions = {}
) => {
  // Default values
  const length = options.length || 40;
  const hookLength = options.hookLength || 6;
  const promptType = options.promptType || "business";

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
    },
    options.customPrompt
  );

  const response = await client.responses.parse({
    model: "gpt-5.1",
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
  return response.output_parsed;
};
