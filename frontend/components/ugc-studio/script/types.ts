export const SCENE_TYPES = [
  "hook",
  "problem",
  "solution",
  "demo",
  "testimonial",
  "cta",
] as const;

export const EMOTIONS = [
  "excited",
  "curious",
  "surprised",
  "frustrated",
  "relieved",
  "confident",
  "friendly",
  "urgent",
  "sincere",
  "playful",
] as const;

export const SHOT_TYPES = ["a-roll", "b-roll", "mixed"] as const;

export const CAMERA_ANGLES = [
  "pov-selfie",
  "medium-shot",
  "close-up",
  "wide-shot",
  "overhead",
  "low-angle",
  "custom",
] as const;

export type SceneType = (typeof SCENE_TYPES)[number];
export type Emotion = (typeof EMOTIONS)[number];
export type ShotType = (typeof SHOT_TYPES)[number];
export type CameraAngle = (typeof CAMERA_ANGLES)[number];

export interface BRollShot {
  action: string;
  cinematicPrompt: string;
  durationSeconds: number;
  productImageNeeded: boolean;
}

export interface UGCScene {
  id: string;
  sceneNumber: number;
  sceneType: SceneType;
  action: string;
  dialogue: string;
  emotion: Emotion;
  estimatedDurationSeconds: number;
  shotType: ShotType;
  cameraAngle: CameraAngle;
  customCameraAngle?: string;
  ambientSound?: string;
  bRollShots?: BRollShot[] | null;
}

export interface UGCScript {
  title: string;
  hook: string;
  targetAudience: string;
  totalEstimatedDuration: number;
  scenes: UGCScene[];
  viralScore: number;
  viralReasoning: string;
  productMentions: {
    sceneId: string;
    productFeature: string;
    visualSuggestion: string;
  }[];
}

export interface ProductImage {
  key: string;
  url: string;
  file?: File;
}

export interface GenerateScriptRequest {
  teamId: number;
  characterId: number;
  productImageKeys: string[];
  productName?: string;
  productDescription?: string;
  scriptDirection?: string;
  targetDuration?: number;
  numberOfVariations?: number;
  structureId?: string;
  customPattern?: { type: SceneType; shot: ShotType }[];
}

export interface GenerateScriptResponse {
  success: boolean;
  scriptId: string;
  status: "queued" | "generating" | "completed" | "failed";
  message: string;
}

export interface ScriptStatusResponse {
  success: boolean;
  scriptId: string;
  status: "queued" | "generating" | "completed" | "failed";
  progress: number;
  progressMessage: string;
  scripts?: UGCScript[];
  selectedVariantIndex?: number;
  error?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RegenerateSceneRequest {
  teamId: number;
  scriptId: string;
  sceneId: string;
  currentDialogue: string;
  currentEmotion: string;
  regenerationType: "dialogue" | "full";
}

export interface RegenerateSceneResponse {
  success: boolean;
  scene: UGCScene;
}

export interface UploadUrlResponse {
  success: boolean;
  uploadUrl: string;
  s3Key: string;
}

export interface ScriptSummary {
  id: string;
  productName: string | null;
  scriptDirection: string | null;
  structureId: string;
  characterId: number;
  characterName: string | null;
  sceneCount: number;
  totalDuration: number;
  title: string;
  hook: string;
  viralScore: number;
  createdAt: string;
}

export const EMOTION_CONFIG: Record<
  Emotion,
  { emoji: string; color: string; label: string }
> = {
  excited: { emoji: "🤩", color: "bg-yellow-500/20", label: "Excited" },
  curious: { emoji: "🤔", color: "bg-blue-500/20", label: "Curious" },
  surprised: { emoji: "😮", color: "bg-purple-500/20", label: "Surprised" },
  frustrated: { emoji: "😤", color: "bg-red-500/20", label: "Frustrated" },
  relieved: { emoji: "😌", color: "bg-green-500/20", label: "Relieved" },
  confident: { emoji: "😎", color: "bg-indigo-500/20", label: "Confident" },
  friendly: { emoji: "😊", color: "bg-pink-500/20", label: "Friendly" },
  urgent: { emoji: "⚡", color: "bg-orange-500/20", label: "Urgent" },
  sincere: { emoji: "🙏", color: "bg-teal-500/20", label: "Sincere" },
  playful: { emoji: "😜", color: "bg-fuchsia-500/20", label: "Playful" },
};

export const SCENE_TYPE_CONFIG: Record<
  SceneType,
  { color: string; icon: string; label: string }
> = {
  hook: {
    color: "bg-purple-500/20 text-purple-400",
    icon: "solar:star-bold-duotone",
    label: "Hook",
  },
  problem: {
    color: "bg-orange-500/20 text-orange-400",
    icon: "solar:danger-triangle-bold-duotone",
    label: "Problem",
  },
  solution: {
    color: "bg-green-500/20 text-green-400",
    icon: "solar:lightbulb-bold-duotone",
    label: "Solution",
  },
  demo: {
    color: "bg-blue-500/20 text-blue-400",
    icon: "solar:play-bold-duotone",
    label: "Demo",
  },
  testimonial: {
    color: "bg-pink-500/20 text-pink-400",
    icon: "solar:heart-bold-duotone",
    label: "Testimonial",
  },
  cta: {
    color: "bg-yellow-500/20 text-yellow-400",
    icon: "solar:arrow-right-up-bold-duotone",
    label: "CTA",
  },
};

export const CAMERA_ANGLE_CONFIG: Record<
  CameraAngle,
  { icon: string; label: string; description: string }
> = {
  "pov-selfie": {
    icon: "solar:smartphone-bold-duotone",
    label: "POV Selfie",
    description: "Phone held at arm's length",
  },
  "medium-shot": {
    icon: "solar:user-bold-duotone",
    label: "Medium Shot",
    description: "Waist up framing",
  },
  "close-up": {
    icon: "solar:magnifer-zoom-in-bold-duotone",
    label: "Close-Up",
    description: "Face or product detail",
  },
  "wide-shot": {
    icon: "solar:gallery-wide-bold-duotone",
    label: "Wide Shot",
    description: "Full body with environment",
  },
  "overhead": {
    icon: "solar:arrow-down-bold-duotone",
    label: "Overhead",
    description: "Looking down from above",
  },
  "low-angle": {
    icon: "solar:arrow-up-bold-duotone",
    label: "Low Angle",
    description: "Looking up at subject",
  },
  "custom": {
    icon: "solar:pen-bold-duotone",
    label: "Custom",
    description: "Define your own angle",
  },
};

export interface ScriptStructure {
  id: string;
  name: string;
  description: string;
  pattern: { type: SceneType; shot: ShotType; duration: string }[];
  bestFor: string[];
  icon: string;
}

export const SCRIPT_STRUCTURES: ScriptStructure[] = [
  {
    id: "classic",
    name: "Classic UGC",
    description: "Hook → Problem → Demo → CTA",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-4s" },
      { type: "problem", shot: "a-roll", duration: "4-6s" },
      { type: "demo", shot: "b-roll", duration: "3-5s" },
      { type: "cta", shot: "a-roll", duration: "3-5s" },
    ],
    bestFor: ["Product demos", "Before/After", "Skincare"],
    icon: "solar:star-bold-duotone",
  },
  {
    id: "problem-solution",
    name: "Problem → Solution",
    description: "Deep pain point, then reveal with proof",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-4s" },
      { type: "problem", shot: "a-roll", duration: "4-6s" },
      { type: "solution", shot: "mixed", duration: "4-6s" },
      { type: "testimonial", shot: "a-roll", duration: "4-5s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Pain point products", "Tech gadgets", "Health supplements"],
    icon: "solar:lightbulb-bolt-bold-duotone",
  },
  {
    id: "storytelling",
    name: "Story Arc",
    description: "Visual journey with transformation",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-4s" },
      { type: "problem", shot: "b-roll", duration: "3-4s" },
      { type: "solution", shot: "a-roll", duration: "4-6s" },
      { type: "testimonial", shot: "a-roll", duration: "4-5s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Lifestyle products", "Transformation stories", "Emotional appeals"],
    icon: "solar:chat-round-like-bold-duotone",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Build your own structure",
    pattern: [],
    bestFor: ["Full control", "Specific needs", "Advanced users"],
    icon: "solar:settings-bold-duotone",
  },
  {
    id: "unboxing",
    name: "Unboxing Reveal",
    description: "Build anticipation with product reveal",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-4s" },
      { type: "demo", shot: "b-roll", duration: "3-5s" },
      { type: "solution", shot: "a-roll", duration: "4-6s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Subscription boxes", "Premium products", "New launches"],
    icon: "solar:box-bold-duotone",
  },
  {
    id: "tutorial",
    name: "Quick Tutorial",
    description: "How-to format with clear steps",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-4s" },
      { type: "demo", shot: "mixed", duration: "4-6s" },
      { type: "demo", shot: "b-roll", duration: "3-5s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Beauty products", "Tech tutorials", "DIY products"],
    icon: "solar:document-text-bold-duotone",
  },
];
