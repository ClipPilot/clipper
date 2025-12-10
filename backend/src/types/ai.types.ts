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
});
