export const PROMPT_TYPES = ["business", "viral", "gaming"] as const;
export type PromptType = (typeof PROMPT_TYPES)[number];

export const PROMPT_TYPE_LABELS: Record<PromptType, string> = {
  business: "Business/Product Demo",
  viral: "Viral/Entertainment",
  gaming: "Gaming/Gameplay",
};

export const PROMPT_TYPE_PLACEHOLDERS: Record<PromptType, string> = {
  business: "e.g., Focus on the product features and benefits...",
  viral: "e.g., Find the funniest moments or biggest reactions...",
  gaming: "Describe the gameplay: e.g., 'Valorant ranked match, focus on clutch plays'",
};
