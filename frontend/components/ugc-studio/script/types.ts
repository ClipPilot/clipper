export const SCENE_TYPES = [
  "hook",
  "problem",
  "agitate",
  "solution",
  "demo",
  "social-proof",
  "testimonial",
  "transformation",
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
  "vulnerable",
  "skeptical",
  "amazed",
  "conspiratorial",
  "empathetic",
  "determined",
] as const;

export const SHOT_TYPES = ["a-roll", "b-roll"] as const;

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
  shotType?: "CHARACTER" | "PRODUCT" | "CHARACTER_AND_PRODUCT";
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
  ambientSound?: string;
  bRollShots?: BRollShot[] | null;
  mergedSceneTypes?: SceneType[] | null;
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
  customPattern?: { type: SceneType; shot: ShotType | "visual" }[];
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
  customPrompt?: string;
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
  vulnerable: { emoji: "🥺", color: "bg-rose-500/20", label: "Vulnerable" },
  skeptical: { emoji: "🤨", color: "bg-slate-500/20", label: "Skeptical" },
  amazed: { emoji: "🤯", color: "bg-violet-500/20", label: "Amazed" },
  conspiratorial: {
    emoji: "🤫",
    color: "bg-amber-500/20",
    label: "Conspiratorial",
  },
  empathetic: { emoji: "💕", color: "bg-pink-400/20", label: "Empathetic" },
  determined: { emoji: "💪", color: "bg-cyan-500/20", label: "Determined" },
};

export const SCENE_TYPE_CONFIG: Record<
  SceneType,
  { color: string; icon: string; label: string; description: string }
> = {
  hook: {
    color: "bg-purple-500/20 text-purple-400",
    icon: "solar:star-bold-duotone",
    label: "Hook",
    description: "Stop the scroll - grab attention immediately",
  },
  problem: {
    color: "bg-orange-500/20 text-orange-400",
    icon: "solar:danger-triangle-bold-duotone",
    label: "Problem",
    description: "Show the relatable pain point",
  },
  agitate: {
    color: "bg-red-500/20 text-red-400",
    icon: "solar:fire-bold-duotone",
    label: "Agitate",
    description: "Intensify the pain - make them feel it",
  },
  solution: {
    color: "bg-green-500/20 text-green-400",
    icon: "solar:lightbulb-bold-duotone",
    label: "Solution",
    description: "Introduce the product/answer",
  },
  demo: {
    color: "bg-blue-500/20 text-blue-400",
    icon: "solar:play-bold-duotone",
    label: "Demo",
    description: "Show the product in action",
  },
  "social-proof": {
    color: "bg-amber-500/20 text-amber-400",
    icon: "solar:users-group-rounded-bold-duotone",
    label: "Social Proof",
    description: "Build credibility with reviews/validation",
  },
  testimonial: {
    color: "bg-pink-500/20 text-pink-400",
    icon: "solar:heart-bold-duotone",
    label: "Testimonial",
    description: "Personal results and experience",
  },
  transformation: {
    color: "bg-teal-500/20 text-teal-400",
    icon: "solar:refresh-bold-duotone",
    label: "Transformation",
    description: "Before/after payoff moment",
  },
  cta: {
    color: "bg-yellow-500/20 text-yellow-400",
    icon: "solar:arrow-right-up-bold-duotone",
    label: "CTA",
    description: "Friendly invitation to act",
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
  overhead: {
    icon: "solar:arrow-down-bold-duotone",
    label: "Overhead",
    description: "Looking down from above",
  },
  "low-angle": {
    icon: "solar:arrow-up-bold-duotone",
    label: "Low Angle",
    description: "Looking up at subject",
  },
  custom: {
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

export interface AutoStructureResponse {
  pattern: { type: SceneType; shot: ShotType | "visual" }[];
  reasoning: string;
  name: string;
  isSilent: boolean;
}

export const SCRIPT_STRUCTURES: ScriptStructure[] = [
  {
    id: "auto",
    name: "Auto (AI Picks)",
    description: "AI analyzes your direction and picks the best structure",
    pattern: [],
    bestFor: ["Best results", "Not sure what to pick", "Smart defaults"],
    icon: "solar:magic-stick-3-bold-duotone",
  },
  {
    id: "classic",
    name: "Classic Hook-Problem-Solution",
    description: "The proven UGC formula that converts",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-3s" },
      { type: "problem", shot: "a-roll", duration: "4-6s" },
      { type: "solution", shot: "b-roll", duration: "4-6s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Most products", "Quick conversions", "First-time creators"],
    icon: "solar:star-bold-duotone",
  },
  {
    id: "problem-agitate-solution",
    name: "PAS (Problem-Agitate-Solution)",
    description: "Dig into the pain before relief - high emotional impact",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-3s" },
      { type: "problem", shot: "a-roll", duration: "3-5s" },
      { type: "agitate", shot: "a-roll", duration: "3-5s" },
      { type: "solution", shot: "b-roll", duration: "4-6s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Pain point products", "Health supplements", "Problem solvers"],
    icon: "solar:fire-bold-duotone",
  },
  {
    id: "social-proof",
    name: "Social Proof Heavy",
    description: "Lead with credibility and validation",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-3s" },
      { type: "social-proof", shot: "a-roll", duration: "4-5s" },
      { type: "demo", shot: "b-roll", duration: "3-5s" },
      { type: "testimonial", shot: "a-roll", duration: "4-5s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Skeptical audiences", "Premium products", "Competitive markets"],
    icon: "solar:users-group-rounded-bold-duotone",
  },
  {
    id: "storytelling",
    name: "Story Arc",
    description: "Mini-narrative with transformation - emotional connection",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-3s" },
      { type: "problem", shot: "a-roll", duration: "4-5s" },
      { type: "transformation", shot: "b-roll", duration: "4-6s" },
      { type: "testimonial", shot: "a-roll", duration: "4-5s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Lifestyle products", "Personal care", "Emotional appeals"],
    icon: "solar:chat-round-like-bold-duotone",
  },
  {
    id: "before-after",
    name: "Before/After Transformation",
    description: "Visual transformation story - powerful for results",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-3s" },
      { type: "problem", shot: "b-roll", duration: "3-4s" },
      { type: "solution", shot: "a-roll", duration: "3-5s" },
      { type: "transformation", shot: "b-roll", duration: "4-5s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Skincare", "Fitness", "Cleaning products", "Makeovers"],
    icon: "solar:refresh-bold-duotone",
  },
  {
    id: "unboxing",
    name: "Unboxing Reveal",
    description: "ASMR-style product reveal - builds anticipation",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-3s" },
      { type: "demo", shot: "b-roll", duration: "4-6s" },
      { type: "solution", shot: "a-roll", duration: "4-5s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Subscription boxes", "Premium products", "New launches"],
    icon: "solar:box-bold-duotone",
  },
  {
    id: "tutorial",
    name: "Quick Tutorial",
    description: "Educational value-first - positions you as expert",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-3s" },
      { type: "demo", shot: "b-roll", duration: "4-6s" },
      { type: "demo", shot: "b-roll", duration: "3-5s" },
      { type: "testimonial", shot: "a-roll", duration: "3-4s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Beauty products", "Tech gadgets", "DIY products"],
    icon: "solar:document-text-bold-duotone",
  },
  {
    id: "controversy",
    name: "Hot Take / Controversy",
    description: "Bold opinion that challenges beliefs - high engagement",
    pattern: [
      { type: "hook", shot: "a-roll", duration: "2-3s" },
      { type: "problem", shot: "a-roll", duration: "4-6s" },
      { type: "solution", shot: "a-roll", duration: "4-6s" },
      { type: "social-proof", shot: "b-roll", duration: "3-4s" },
      { type: "cta", shot: "a-roll", duration: "3-4s" },
    ],
    bestFor: ["Disruptive products", "Bold brands", "Standing out"],
    icon: "solar:chat-square-call-bold-duotone",
  },
  {
    id: "long-form",
    name: "Long-Form Speech",
    description:
      "Single continuous monologue — testimonials, stories, speeches",
    pattern: [{ type: "testimonial", shot: "a-roll", duration: "30-180s" }],
    bestFor: ["Testimonials", "Personal stories", "Long monologues"],
    icon: "solar:microphone-3-bold-duotone",
  },
  {
    id: "silent-before-after",
    name: "Before/After",
    description:
      "Two B-roll scenes — no voiceover, just visual transformation. Pairs well with music and text overlays.",
    pattern: [
      { type: "problem", shot: "b-roll", duration: "5s" },
      { type: "transformation", shot: "b-roll", duration: "5s" },
    ],
    bestFor: [
      "Skincare results",
      "Cleaning demos",
      "Visual transformations",
      "ASMR-style",
    ],
    icon: "solar:gallery-minimalistic-bold-duotone",
  },
  {
    id: "silent-showcase",
    name: "Product Showcase",
    description:
      "All-visual product spotlight — no voiceover, just compelling visuals. Pairs well with music and text overlays.",
    pattern: [
      { type: "hook", shot: "b-roll", duration: "3-4s" },
      { type: "demo", shot: "b-roll", duration: "4-5s" },
      { type: "cta", shot: "b-roll", duration: "3-4s" },
    ],
    bestFor: ["Product launches", "Beauty", "E-commerce", "Food"],
    icon: "solar:bag-smile-bold-duotone",
  },
  {
    id: "silent-montage",
    name: "Aesthetic Montage",
    description:
      "Dreamy visual slideshow — no voiceover, pure aesthetic storytelling. Great with ambient music.",
    pattern: [
      { type: "hook", shot: "b-roll", duration: "3s" },
      { type: "demo", shot: "b-roll", duration: "3-4s" },
      { type: "demo", shot: "b-roll", duration: "3-4s" },
      { type: "transformation", shot: "b-roll", duration: "3-4s" },
    ],
    bestFor: ["Lifestyle brands", "ASMR", "Fashion", "Satisfying processes"],
    icon: "solar:gallery-bold-duotone",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Build your own structure from scratch",
    pattern: [],
    bestFor: ["Full control", "Specific needs", "Advanced users"],
    icon: "solar:settings-bold-duotone",
  },
];
