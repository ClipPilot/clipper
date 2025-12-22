export const PROMPT_TYPES = ["business", "viral", "gaming"] as const;
export type PromptType = (typeof PROMPT_TYPES)[number];

export const isValidPromptType = (value: string): value is PromptType => {
  return PROMPT_TYPES.includes(value as PromptType);
};
