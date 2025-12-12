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
}

// Zod schemas
export const ClipSegmentSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
});

export const ClipSuggestionsSchema = z.object({
  hook: ClipSegmentSchema,
  main: z.array(ClipSegmentSchema),
  combined_script: z.string(),
  finalMessage: z.string().describe("A brief message describing what makes this clip engaging and why it was selected"),
  evalScore: z.number().min(0).max(100).describe("A score from 0-100 rating the viral potential and quality of this clip selection"),
});

export const MultipleClipSuggestionsSchema = z.object({
  videos: z.array(ClipSuggestionsSchema).describe("Array of different video clip suggestions, each with unique approaches and styles"),
});

export interface MultipleClipSuggestions {
  videos: ClipSuggestions[];
}
