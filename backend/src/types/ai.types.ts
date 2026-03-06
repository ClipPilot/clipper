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
  viralHeading?: string;
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
  viralHeading: z
    .string()
    .describe(
      "A 3-6 word ALL CAPS viral heading to overlay on the video. Should create curiosity, urgency, or shock. Include 1-2 relevant emojis. No hashtags or quotes."
    ),
});

export const MultipleClipSuggestionsSchema = z.object({
  videos: z
    .array(ClipSuggestionsSchema)
    .describe("Array of video clip suggestions"),
});

export interface MultipleClipSuggestions {
  videos: ClipSuggestions[];
}

// Batch video processing types
export interface BatchClipSegment {
  start: number;
  end: number;
  text: string;
  sourceVideoIndex: number; // 0-4, identifies which source video this segment comes from
}

export interface BatchClipSuggestions {
  hook: BatchClipSegment;
  main: Array<BatchClipSegment>;
  combined_script: string;
  finalMessage: string;
  evalScore: number;
  clipTitle?: string;
  viralHeading?: string;
}

export const BatchClipSegmentSchema = z.object({
  text: z.string().describe("The spoken text or description of this segment"),
  start: z.number().describe("Start timestamp in seconds"),
  end: z.number().describe("End timestamp in seconds"),
  sourceVideoIndex: z
    .number()
    .min(0)
    .max(4)
    .describe("Index of the source video (0-4) this segment comes from"),
});

export const BatchClipSuggestionsSchema = z.object({
  hook: BatchClipSegmentSchema.describe(
    "The attention-grabbing opening segment from any source video"
  ),
  main: z
    .array(BatchClipSegmentSchema)
    .describe(
      "Array of main content segments from any source videos, each with sourceVideoIndex"
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
  viralHeading: z
    .string()
    .describe(
      "A 3-6 word ALL CAPS viral heading to overlay on the video. Should create curiosity, urgency, or shock. Include 1-2 relevant emojis. No hashtags or quotes."
    ),
});

export const MultipleBatchClipSuggestionsSchema = z.object({
  videos: z
    .array(BatchClipSuggestionsSchema)
    .describe("Array of batch video clip suggestions"),
});

export interface MultipleBatchClipSuggestions {
  videos: BatchClipSuggestions[];
}
