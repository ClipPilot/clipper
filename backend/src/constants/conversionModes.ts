export const CONVERSION_MODES = [
  "standard",
  "gaming",
  "speaker-zoom",
  "center-crop",
] as const;

export type ConversionMode = (typeof CONVERSION_MODES)[number];

export function isValidConversionMode(value: string): value is ConversionMode {
  return CONVERSION_MODES.includes(value as ConversionMode);
}
