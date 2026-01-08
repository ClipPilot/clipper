export interface AppearanceConfig {
  hairColor: "blonde" | "brunette" | "black" | "red" | "gray" | "custom";
  hairStyle: "short" | "medium" | "long" | "wavy" | "curly" | "straight";
  skinTone: "fair" | "light" | "medium" | "tan" | "dark";
  eyeColor: "brown" | "blue" | "green" | "hazel" | "gray";
  bodyType: "slim" | "athletic" | "average" | "curvy";
}

export interface StyleConfig {
  outfit: "casual" | "gym" | "office" | "cozy-home" | "streetwear" | "other";
  outfitCustom?: string;
  setting: string;
  cameraStyle: "phone-selfie" | "tripod" | "mirror" | "ring-light";
  anythingElse?: string;
}

export interface Character {
  id: number;
  team_id: number;
  name: string;
  public: boolean;
  gender: "male" | "female" | null;
  age_range: "18-25" | "25-35" | "35-45" | "45+" | null;
  appearance_config: AppearanceConfig | null;
  style_config: StyleConfig | null;
  character_images: string[];
  primary_image_index: number;
  reference_images: string[] | null;
  generation_prompt: string | null;
  parent_character_id: number | null;
  is_variation: boolean;
  uses_count: number;
  created_at: string;
  updated_at: string;
  imageUrls?: string[];
  primaryImageUrl?: string;
}

export interface CharacterConfig {
  gender: string;
  ageRange: string;
  appearance: AppearanceConfig;
  style: StyleConfig;
  referenceImages?: string[];
}

export interface GeneratedImage {
  key: string;
  url: string;
  index: number;
}

export interface GeneratePreviewResponse {
  success: boolean;
  jobId: string;
  status: "queued" | "generating" | "completed" | "failed";
  message?: string;
}

export interface GenerationStatusResponse {
  success: boolean;
  jobId: string;
  status: "queued" | "generating" | "completed" | "failed";
  progress: number;
  progressMessage: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  images?: GeneratedImage[];
  prompt?: string;
  error?: string;
}

export interface UsageInfo {
  baseRemaining: number;
  addonRemaining: number;
  totalRemaining: number;
}

export interface CreateCharacterResponse {
  success: boolean;
  character: Character;
  creditCost: number;
  creditsCharged: {
    total: number;
    fromBase: number;
    fromAddon: number;
  };
  usage: UsageInfo;
}

export interface InsufficientCreditsError {
  error: string;
  code: "INSUFFICIENT_CREDITS";
  required: number;
  available: number;
  usage: UsageInfo;
}

export type CharacterSource = "my-actors" | "community" | "create-new";

export type CreateStep = "basic-info" | "appearance" | "style" | "references" | "generate";

export const HAIR_COLORS = [
  { value: "blonde", label: "Blonde", color: "#F5DEB3" },
  { value: "brunette", label: "Brunette", color: "#8B4513" },
  { value: "black", label: "Black", color: "#1C1C1C" },
  { value: "red", label: "Red", color: "#B22222" },
  { value: "gray", label: "Gray", color: "#808080" },
] as const;

export const HAIR_STYLES = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
  { value: "wavy", label: "Wavy" },
  { value: "curly", label: "Curly" },
  { value: "straight", label: "Straight" },
] as const;

export const SKIN_TONES = [
  { value: "fair", label: "Fair", color: "#FDEBD0" },
  { value: "light", label: "Light", color: "#F5CBA7" },
  { value: "medium", label: "Medium", color: "#D4AC0D" },
  { value: "tan", label: "Tan", color: "#BA7E3F" },
  { value: "dark", label: "Dark", color: "#6E2C00" },
] as const;

export const EYE_COLORS = [
  { value: "brown", label: "Brown", color: "#8B4513" },
  { value: "blue", label: "Blue", color: "#4169E1" },
  { value: "green", label: "Green", color: "#228B22" },
  { value: "hazel", label: "Hazel", color: "#8E7618" },
  { value: "gray", label: "Gray", color: "#708090" },
] as const;

export const BODY_TYPES = [
  { value: "slim", label: "Slim" },
  { value: "athletic", label: "Athletic" },
  { value: "average", label: "Average" },
  { value: "curvy", label: "Curvy" },
] as const;


export const OUTFITS = [
  { value: "casual", label: "Casual" },
  { value: "gym", label: "Gym" },
  { value: "office", label: "Office" },
  { value: "cozy-home", label: "Cozy Home" },
  { value: "streetwear", label: "Streetwear" },
  { value: "other", label: "Other" },
] as const;

export const SETTINGS = [
  { value: "bedroom", label: "Bedroom" },
  { value: "living-room", label: "Living Room" },
  { value: "kitchen", label: "Kitchen" },
  { value: "car", label: "Car" },
  { value: "bathroom-mirror", label: "Bathroom Mirror" },
  { value: "outdoor", label: "Outdoor" },
] as const;

export const CAMERA_STYLES = [
  { value: "phone-selfie", label: "Phone Selfie" },
  { value: "tripod", label: "Tripod" },
  { value: "mirror", label: "Mirror" },
  { value: "ring-light", label: "Ring Light" },
] as const;

export const LIGHTING_OPTIONS = [
  { value: "natural", label: "Natural" },
  { value: "flash", label: "Flash" },
  { value: "soft-studio", label: "Soft Studio" },
  { value: "golden-hour", label: "Golden Hour" },
] as const;

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export const AGE_RANGES = [
  { value: "18-25", label: "18-25" },
  { value: "25-35", label: "25-35" },
  { value: "35-45", label: "35-45" },
  { value: "45+", label: "45+" },
] as const;

