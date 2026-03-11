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
    isSilent: false,
    character: true,
    description:
      "Music-driven montage with character — actor appears but emphasis on visual flow. Before/after videos or showing the character in many b-roll shots.",
  },
  nocharacter_montage: {
    name: "No Character Montage",
    isSilent: false,
    character: false,
    description:
      "Pure visual montage — no actor, all b-roll. Product-only aesthetic videos, focusing on the product or service through various clips and scenes.",
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
    sceneType: z.enum(["a-roll", "b-roll"]),
    slug: z.string(),
    description: z.union([storyBeatEnum, z.string()]),
    shots: z
      .array(
        z.object({
          label: z.string().describe("Brief description of this shot (3-8 words, e.g. 'Close-up of product texture')"),
          shotType: z.enum(["CHARACTER", "PRODUCT", "CHARACTER_AND_PRODUCT"]).describe("What appears in the shot"),
        }),
      )
      .min(1)
      .max(5)
      .optional()
      .describe("Only for b-roll scenes. Product-focused scenes (demo, transformation): 2-5 shots. Other b-roll: 1-2 shots. Omit for a-roll."),
  }),
);

export const initAgentSchema = z.object({
  isSilent: z.boolean().default(false),
  character: z.boolean().default(true),
  structure: structureSchema,
  videoType: videoTypeEnum,
});
