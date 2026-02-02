"use client";

import { atom } from "jotai";
import { CaptionEntry, Clip } from "@/api/clips";

// Editor tool types
export type EditorTool = "trim" | "crop" | "speed" | "audio" | "captions" | "heading";

// Aspect ratio types
export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5" | "custom";

// Trim state
export interface TrimState {
  startTime: number;
  endTime: number;
}

// Crop state
export interface CustomCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropState {
  aspectRatio: AspectRatio;
  customCrop?: CustomCrop;
}

// Audio state
export interface BackgroundMusic {
  s3Key: string;
  fileName: string;
  url: string;
  volume: number;
  startTime: number; // Where in video timeline music begins
  trimStart: number; // Trim within music file
  trimEnd: number; // Trim within music file
  duration: number; // Full music duration
}

export interface AudioState {
  originalVolume: number;
  originalMuted: boolean;
  backgroundMusic?: BackgroundMusic;
}

// Heading state
export interface HeadingState {
  text: string;
  color: string;
  font: string;
  x: number;
  y: number;
  fontSize: number;
}

// Captions state
export interface CaptionsState {
  enabled: boolean;
  data: CaptionEntry[];
  color: string;
  font: string;
}

// Full editor state for undo/redo
export interface EditorSnapshot {
  trim: TrimState;
  crop: CropState;
  speed: number;
  audio: AudioState;
  captions: CaptionsState;
  heading: HeadingState | null;
}

// Video edit config for API submission
export interface VideoEditConfig {
  trim?: TrimState;
  crop?: CropState;
  speed?: number;
  audio?: AudioState;
  captions?: CaptionsState;
  heading?: HeadingState;
}

// =============================================================================
// Core Atoms
// =============================================================================

// Clip data
export const editorClipAtom = atom<Clip | null>(null);
export const editorLoadingAtom = atom<boolean>(true);
export const editorAccessDeniedAtom = atom<boolean>(false);

// Video playback
export const videoDurationAtom = atom<number>(0);
export const currentTimeAtom = atom<number>(0);
export const isPlayingAtom = atom<boolean>(false);

// Active tool
export const activeToolAtom = atom<EditorTool>("trim");

// =============================================================================
// Tool State Atoms
// =============================================================================

// Trim
export const trimStateAtom = atom<TrimState>({
  startTime: 0,
  endTime: 0,
});

// Crop
export const cropStateAtom = atom<CropState>({
  aspectRatio: "9:16",
});

// Speed (1.0 = normal, 0.25-4.0 range)
export const speedStateAtom = atom<number>(1.0);

// Audio
export const audioStateAtom = atom<AudioState>({
  originalVolume: 1,
  originalMuted: false,
});

// Captions
export const captionsEnabledAtom = atom<boolean>(true);
export const captionsDataAtom = atom<CaptionEntry[]>([]);
export const captionColorAtom = atom<string>("#FFD600");
export const captionFontAtom = atom<string>("Luckiest Guy");

// Heading
export const headingStateAtom = atom<HeadingState | null>(null);

// =============================================================================
// UI State Atoms
// =============================================================================

export const isSavingAtom = atom<boolean>(false);
export const hasUnsavedChangesAtom = atom<boolean>(false);
export const showSuccessModalAtom = atom<boolean>(false);

// Timeline
export const isDraggingPlayheadAtom = atom<boolean>(false);
export const isDraggingTrimHandleAtom = atom<"start" | "end" | null>(null);
export const thumbnailsAtom = atom<string[]>([]);
export const isGeneratingThumbnailsAtom = atom<boolean>(false);
export const waveformDataAtom = atom<number[]>([]);
export const isGeneratingWaveformAtom = atom<boolean>(false);

// =============================================================================
// Edit History Atoms (for undo/redo)
// =============================================================================

export const editHistoryAtom = atom<EditorSnapshot[]>([]);
export const historyIndexAtom = atom<number>(-1);

// =============================================================================
// Derived Atoms
// =============================================================================

// Final duration after trim
export const finalDurationAtom = atom((get) => {
  const trim = get(trimStateAtom);
  const speed = get(speedStateAtom);
  const duration = trim.endTime - trim.startTime;
  return duration / speed;
});

// Captions state combined
export const captionsStateAtom = atom((get) => ({
  enabled: get(captionsEnabledAtom),
  data: get(captionsDataAtom),
  color: get(captionColorAtom),
  font: get(captionFontAtom),
}));

// Combined edit config for API submission
export const editConfigAtom = atom<VideoEditConfig>((get) => {
  const trim = get(trimStateAtom);
  const crop = get(cropStateAtom);
  const speed = get(speedStateAtom);
  const audio = get(audioStateAtom);
  const captions = get(captionsStateAtom);
  const heading = get(headingStateAtom);
  const duration = get(videoDurationAtom);

  const config: VideoEditConfig = {};

  // Only include trim if changed from full video
  if (trim.startTime > 0 || trim.endTime < duration) {
    config.trim = trim;
  }

  // Only include crop if not default 9:16
  if (crop.aspectRatio !== "9:16" || crop.customCrop) {
    config.crop = crop;
  }

  // Only include speed if not 1.0
  if (speed !== 1.0) {
    config.speed = speed;
  }

  // Only include audio if changed
  if (audio.originalVolume !== 1 || audio.originalMuted || audio.backgroundMusic) {
    config.audio = audio;
  }

  // Always include captions state
  config.captions = captions;

  // Include heading if set
  if (heading && heading.text.trim()) {
    config.heading = heading;
  }

  return config;
});

// Check if any edits have been made
export const hasEditsAtom = atom((get) => {
  const config = get(editConfigAtom);
  const duration = get(videoDurationAtom);
  const trim = get(trimStateAtom);

  // Check if trim is different from full video
  const hasTrim = trim.startTime > 0 || trim.endTime < duration;

  // Check other edits
  const hasCrop = config.crop !== undefined;
  const hasSpeed = config.speed !== undefined;
  const hasAudio = config.audio !== undefined;
  const hasHeading = config.heading !== undefined;

  return hasTrim || hasCrop || hasSpeed || hasAudio || hasHeading;
});

// =============================================================================
// Speed Presets
// =============================================================================

export const SPEED_PRESETS = [
  { value: 0.25, label: "0.25x" },
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1.0, label: "1x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2.0, label: "2x" },
  { value: 3.0, label: "3x" },
  { value: 4.0, label: "4x" },
];

// =============================================================================
// Aspect Ratio Presets
// =============================================================================

export const ASPECT_RATIO_PRESETS: { value: AspectRatio; label: string; ratio: number }[] = [
  { value: "9:16", label: "9:16", ratio: 9 / 16 },
  { value: "16:9", label: "16:9", ratio: 16 / 9 },
  { value: "1:1", label: "1:1", ratio: 1 },
  { value: "4:5", label: "4:5", ratio: 4 / 5 },
];
