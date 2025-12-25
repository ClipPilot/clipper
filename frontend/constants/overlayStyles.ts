export interface ColorOption {
  color: string;
  name: string;
}

export interface FontOption {
  id: string;
  name: string;
}

export const OVERLAY_COLORS: ColorOption[] = [
  { color: "#FFFFFF", name: "White" },
  { color: "#000000", name: "Black" },
  { color: "#FF0000", name: "Red" },
  { color: "#FF6B00", name: "Orange" },
  { color: "#FFD600", name: "Yellow" },
  { color: "#00FF00", name: "Lime" },
  { color: "#00D4AA", name: "Teal" },
  { color: "#0084FF", name: "Blue" },
  { color: "#7B2CBF", name: "Purple" },
  { color: "#FF006E", name: "Pink" },
  { color: "#8B4513", name: "Brown" },
  { color: "#808080", name: "Gray" },
];

export const EXTENDED_COLORS: ColorOption[] = [
  ...OVERLAY_COLORS,
  { color: "#FFE5E5", name: "Light Pink" },
  { color: "#E5F4FF", name: "Light Blue" },
  { color: "#FFFBE5", name: "Light Yellow" },
  { color: "#E5FFE5", name: "Light Green" },
];

export const HEADING_COLOR_PRESETS: ColorOption[] = [
  { color: "#FFFFFF", name: "White" },
  { color: "#FFD600", name: "Yellow" },
  { color: "#FF0000", name: "Red" },
  { color: "#00FF00", name: "Green" },
  { color: "#00BFFF", name: "Blue" },
  { color: "#FF69B4", name: "Pink" },
  { color: "#FFA500", name: "Orange" },
  { color: "#9B59B6", name: "Purple" },
];

export const CAPTION_FONTS: FontOption[] = [
  { id: "luckiest-guy", name: "Luckiest Guy" },
  { id: "montserrat", name: "Montserrat" },
  { id: "everlasting", name: "Everlasting" },
  { id: "komika", name: "Komika" },
  { id: "burbank", name: "Burbank" },
  { id: "bebas-neue", name: "Bebas Neue" },
  { id: "anton", name: "Anton" },
];

export const HEADING_FONTS: FontOption[] = [
  { id: "luckiest-guy", name: "Luckiest Guy" },
  { id: "montserrat", name: "Montserrat" },
  { id: "bebas-neue", name: "Bebas Neue" },
  { id: "anton", name: "Anton" },
];

export const TEXT_POSITIONS = [
  { key: "top", label: "Top", icon: "solar:align-top-bold" },
  { key: "middle", label: "Middle", icon: "solar:align-vertical-center-bold" },
  { key: "bottom", label: "Bottom", icon: "solar:align-bottom-bold" },
] as const;

export type TextPosition = (typeof TEXT_POSITIONS)[number]["key"];
