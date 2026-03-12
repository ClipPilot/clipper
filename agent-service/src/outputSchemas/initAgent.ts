import { z } from "zod";

const storyBeatEnum = z.enum([
  "hook",
  "problem",
  "agitate",
  "solution",
  "demo",
  "social-proof",
  "testimonial",
  "transformation",
  "cta",
]);

export const VIDEO_TYPES = {
  ugc: {
    name: "UGC",
    isSilent: false,
    character: true,
    description:
      "Standard UGC ad — actor speaking to camera about a product. Default for most requests.",
  },
  reaction: {
    name: "Reaction",
    isSilent: true,
    character: true,
    description:
      "Reaction-style video — actor reacts to content, no voiceover. Music overlay with b-roll reaction shots and product demo.",
  },
  montage: {
    name: "Montage",
    isSilent: true,
    character: true,
    description:
      "Music-driven montage with character — actor appears but NO dialogue/voiceover. All scenes are visual. Before/after videos or showing the character in many visual shots.",
  },
  nocharacter_montage: {
    name: "No Character Montage",
    isSilent: true,
    character: false,
    description:
      "Pure visual montage — no actor, no dialogue. All scenes are visual. Product-only aesthetic videos, focusing on the product or service through various clips and scenes.",
  },
} as const;

export const videoTypeEnum = z.enum(
  Object.keys(VIDEO_TYPES) as [
    keyof typeof VIDEO_TYPES,
    ...(keyof typeof VIDEO_TYPES)[],
  ],
);

export const structureSchema = z.array(
  z.object({
    sceneType: z.enum(["a-roll", "b-roll", "visual"]),
    slug: z.string(),
    description: z.union([storyBeatEnum, z.string()]),
    shots: z
      .array(
        z.object({
          label: z.string().describe("Brief description of this shot (3-8 words, e.g. 'Close-up of product texture')"),
          shotType: z.enum(["CHARACTER", "PRODUCT", "CHARACTER_AND_PRODUCT"]).describe("What appears in the shot"),
        }),
      )
      .describe("Shot breakdown. For b-roll/visual scenes: 1-5 shots. For a-roll scenes: set to empty array []."),
  }),
);

export const initAgentSchema = z.object({
  responseType: z.enum(["conversation", "structure"]).describe(
    "Default to 'structure' — generate a structure for ANY video-related request, even vague ones. Only use 'conversation' for completely unrelated messages or explicit non-video questions.",
  ),
  message: z.string().describe(
    "Your conversational reply to the user. Always include a message — for 'structure' responses this accompanies the structure, for 'conversation' responses this IS the response.",
  ),
  isSilent: z.boolean().describe("Whether the video is silent. Set to false for conversation responses."),
  character: z.boolean().describe("Whether the video has a character. Set to true for conversation responses."),
  structure: structureSchema.describe("The scene structure array. Set to an empty array [] for conversation responses."),
  videoType: videoTypeEnum.describe("The video type. Set to 'ugc' for conversation responses."),
});
