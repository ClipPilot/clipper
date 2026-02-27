export interface GraphicTypeConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const GRAPHIC_TYPES: GraphicTypeConfig[] = [
  {
    id: "instagram-ad",
    name: "Instagram Ad",
    description: "Bold, scroll-stopping visuals for Instagram feed and stories",
    icon: "solar:camera-bold-duotone",
  },
  {
    id: "facebook-ad",
    name: "Facebook Ad",
    description: "Clean, conversion-focused designs for Facebook campaigns",
    icon: "solar:like-bold-duotone",
  },
  {
    id: "product-showcase",
    name: "Product Showcase",
    description: "Premium studio-quality product imagery",
    icon: "solar:bag-smile-bold-duotone",
  },
  {
    id: "banner-display-ad",
    name: "Banner / Display Ad",
    description: "Eye-catching banner graphics for display networks",
    icon: "solar:monitor-bold-duotone",
  },
  {
    id: "custom",
    name: "Custom",
    description: "General-purpose marketing graphic with your own direction",
    icon: "solar:palette-bold-duotone",
  },
];

export interface StylePresetConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const STYLE_PRESETS: StylePresetConfig[] = [
  {
    id: "tile-ad",
    name: "Art Director",
    description: "2D/3D fusion with brand simulation",
    icon: "solar:layers-bold-duotone",
  },
  {
    id: "collage",
    name: "Collage",
    description: "Layered photos and mixed media",
    icon: "solar:gallery-bold-duotone",
  },
  {
    id: "photoshoot",
    name: "Photoshoot",
    description: "Luxury campaign photography, no text",
    icon: "solar:camera-bold-duotone",
  },
  {
    id: "flat-lay",
    name: "Flat Lay",
    description: "Top-down product arrangement on styled surface",
    icon: "solar:box-bold-duotone",
  },
  {
    id: "ugc",
    name: "UGC / Lo-fi",
    description: "Organic, authentic content that blends into the feed",
    icon: "solar:smartphone-bold-duotone",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Ultra clean with max white space",
    icon: "solar:minimize-square-bold-duotone",
  },
];

export interface AspectRatioConfig {
  value: string;
  label: string;
  description: string;
}

export const ASPECT_RATIOS: AspectRatioConfig[] = [
  { value: "1:1", label: "1:1", description: "Square" },
  { value: "9:16", label: "9:16", description: "Story / Reel" },
  { value: "16:9", label: "16:9", description: "Landscape" },
  { value: "4:5", label: "4:5", description: "Instagram Feed" },
  { value: "3:4", label: "3:4", description: "Portrait" },
  { value: "2:3", label: "2:3", description: "Pinterest" },
];
