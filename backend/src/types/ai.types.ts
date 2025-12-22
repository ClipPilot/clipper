import { z } from "zod";

export interface ClipSegment {
  start: number;
  end: number;
  text: string;
}

export interface ClipSuggestions {
  hook: ClipSegment;
  main: Array<ClipSegment>;
  combined_script: string;
  finalMessage: string;
  evalScore: number;
  clipTitle?: string;
}

export const ClipSegmentSchema = z.object({
  text: z.string().describe("The spoken text or description of this segment"),
  start: z.number().describe("Start timestamp in seconds"),
  end: z.number().describe("End timestamp in seconds"),
});

export const ClipSuggestionsSchema = z.object({
  hook: ClipSegmentSchema.describe(
    "The attention-grabbing opening segment with start/end timestamps"
  ),
  main: z
    .array(ClipSegmentSchema)
    .describe(
      "Array of main content segments, each with text and start/end timestamps"
    ),
  combined_script: z
    .string()
    .describe("The full combined text/script of all segments"),
  finalMessage: z
    .string()
    .describe("A brief message describing what makes this clip engaging"),
  evalScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Score from 0-100 rating viral potential"),
  clipTitle: z.string().describe("A catchy title for the clip"),
});

export const MultipleClipSuggestionsSchema = z.object({
  videos: z
    .array(ClipSuggestionsSchema)
    .describe("Array of video clip suggestions"),
});

export interface MultipleClipSuggestions {
  videos: ClipSuggestions[];
}
