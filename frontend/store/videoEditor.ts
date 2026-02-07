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

// =============================================================================
// Segment Types (for split/cut/select/per-segment speed)
// =============================================================================

export type SegmentId = string;

export interface Segment {
  id: SegmentId;
  startTime: number;
  endTime: number;
  speed: number; // Per-segment speed (0.25-4.0)
}

export interface SegmentsState {
  segments: Segment[];
  selectedSegmentId: SegmentId | null;
}

// Helper to generate unique segment IDs
export const generateSegmentId = (): SegmentId =>
  `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Full editor state for undo/redo
export interface EditorSnapshot {
  trim: TrimState;
  crop: CropState;
  speed: number;
  audio: AudioState;
  captions: CaptionsState;
  heading: HeadingState | null;
}

// Segment config for API submission
export interface SegmentConfig {
  id: string;
  startTime: number;
  endTime: number;
  speed: number;
}

// Video edit config for API submission
export interface VideoEditConfig {
  trim?: TrimState;
  crop?: CropState;
  speed?: number;
  audio?: AudioState;
  captions?: CaptionsState;
  heading?: HeadingState;
  segments?: SegmentConfig[]; // New: per-segment editing
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
// Segment Atoms
// =============================================================================

// Main segments state
export const segmentsStateAtom = atom<SegmentsState>({
  segments: [],
  selectedSegmentId: null,
});

// History for undo/redo (stores previous segment states)
export const segmentHistoryAtom = atom<Segment[][]>([]);
export const segmentHistoryIndexAtom = atom<number>(-1);

// Derived: Get selected segment
export const selectedSegmentAtom = atom((get) => {
  const state = get(segmentsStateAtom);
  if (!state.selectedSegmentId) return null;
  return state.segments.find((s) => s.id === state.selectedSegmentId) || null;
});

// Derived: Get active (non-deleted) segments - now just returns all segments since we remove deleted ones
export const activeSegmentsAtom = atom((get) => {
  const state = get(segmentsStateAtom);
  return state.segments;
});

// Derived: Can undo
export const canUndoAtom = atom((get) => {
  const index = get(segmentHistoryIndexAtom);
  return index > 0;
});

// Derived: Can redo
export const canRedoAtom = atom((get) => {
  const history = get(segmentHistoryAtom);
  const index = get(segmentHistoryIndexAtom);
  return index < history.length - 1;
});

// Write atom: Undo
export const undoSegmentsAtom = atom(null, (get, set) => {
  const history = get(segmentHistoryAtom);
  const index = get(segmentHistoryIndexAtom);

  if (index > 0) {
    const newIndex = index - 1;
    set(segmentHistoryIndexAtom, newIndex);
    set(segmentsStateAtom, {
      segments: [...history[newIndex]],
      selectedSegmentId: null,
    });
  }
});

// Write atom: Redo
export const redoSegmentsAtom = atom(null, (get, set) => {
  const history = get(segmentHistoryAtom);
  const index = get(segmentHistoryIndexAtom);

  if (index < history.length - 1) {
    const newIndex = index + 1;
    set(segmentHistoryIndexAtom, newIndex);
    set(segmentsStateAtom, {
      segments: [...history[newIndex]],
      selectedSegmentId: null,
    });
  }
});

// Write atom: Split segment at given time
export const splitSegmentAtom = atom(null, (get, set, splitTime: number) => {
  const state = get(segmentsStateAtom);
  const segmentToSplit = state.segments.find(
    (s) => splitTime > s.startTime + 0.5 && splitTime < s.endTime - 0.5
  );

  if (!segmentToSplit) return;

  // Save current state to history before making changes
  const history = get(segmentHistoryAtom);
  const index = get(segmentHistoryIndexAtom);
  const newHistory = history.slice(0, index + 1);
  newHistory.push([...state.segments]);
  if (newHistory.length > 50) newHistory.shift();
  set(segmentHistoryAtom, newHistory);
  set(segmentHistoryIndexAtom, newHistory.length - 1);

  const newSegments = state.segments.flatMap((segment) => {
    if (segment.id !== segmentToSplit.id) return [segment];

    // Create two new segments from the split
    return [
      {
        ...segment,
        id: generateSegmentId(),
        endTime: splitTime,
      },
      {
        id: generateSegmentId(),
        startTime: splitTime,
        endTime: segment.endTime,
        speed: segment.speed,
      },
    ];
  });

  set(segmentsStateAtom, {
    segments: newSegments,
    selectedSegmentId: null,
  });
});

// Write atom: Delete (cut) selected segment - actually removes it
export const deleteSegmentAtom = atom(null, (get, set) => {
  const state = get(segmentsStateAtom);
  if (!state.selectedSegmentId) return;

  // Cannot delete if only one segment
  if (state.segments.length <= 1) return;

  // Save current state to history before making changes
  const history = get(segmentHistoryAtom);
  const index = get(segmentHistoryIndexAtom);
  const newHistory = history.slice(0, index + 1);
  newHistory.push([...state.segments]);
  if (newHistory.length > 50) newHistory.shift();
  set(segmentHistoryAtom, newHistory);
  set(segmentHistoryIndexAtom, newHistory.length - 1);

  set(segmentsStateAtom, {
    segments: state.segments.filter((s) => s.id !== state.selectedSegmentId),
    selectedSegmentId: null,
  });
});

// Write atom: Select a segment
export const selectSegmentAtom = atom(null, (get, set, segmentId: SegmentId | null) => {
  const state = get(segmentsStateAtom);
  set(segmentsStateAtom, {
    ...state,
    selectedSegmentId: segmentId,
  });
});

// Write atom: Update segment speed (no history - speed changes are frequent)
export const updateSegmentSpeedAtom = atom(
  null,
  (get, set, { segmentId, speed }: { segmentId: SegmentId; speed: number }) => {
    const state = get(segmentsStateAtom);

    set(segmentsStateAtom, {
      ...state,
      segments: state.segments.map((s) => (s.id === segmentId ? { ...s, speed } : s)),
    });
  }
);

// Write atom: Update all segments speed (no history - speed changes are frequent)
export const updateAllSegmentsSpeedAtom = atom(null, (get, set, speed: number) => {
  const state = get(segmentsStateAtom);

  set(segmentsStateAtom, {
    ...state,
    segments: state.segments.map((s) => ({ ...s, speed })),
  });
});

// Write atom: Trim/resize a segment (no history during drag - too frequent)
export const trimSegmentAtom = atom(
  null,
  (
    get,
    set,
    { segmentId, startTime, endTime }: { segmentId: SegmentId; startTime?: number; endTime?: number }
  ) => {
    const state = get(segmentsStateAtom);
    const segment = state.segments.find((s) => s.id === segmentId);
    if (!segment) return;

    // Validate new times
    const newStart = startTime !== undefined ? startTime : segment.startTime;
    const newEnd = endTime !== undefined ? endTime : segment.endTime;

    // Ensure minimum duration of 0.5s
    if (newEnd - newStart < 0.5) return;

    set(segmentsStateAtom, {
      ...state,
      segments: state.segments.map((s) =>
        s.id === segmentId ? { ...s, startTime: newStart, endTime: newEnd } : s
      ),
    });
  }
);

// Write atom: Move segment to new time position (shift start/end together)
export const moveSegmentAtom = atom(
  null,
  (
    get,
    set,
    { segmentId, newStartTime }: { segmentId: SegmentId; newStartTime: number }
  ) => {
    const state = get(segmentsStateAtom);
    const segment = state.segments.find((s) => s.id === segmentId);
    if (!segment) return;

    const duration = segment.endTime - segment.startTime;
    const videoDuration = get(videoDurationAtom);

    // Constrain to video bounds
    const constrainedStart = Math.max(0, Math.min(videoDuration - duration, newStartTime));
    const newEnd = constrainedStart + duration;

    set(segmentsStateAtom, {
      ...state,
      segments: state.segments.map((s) =>
        s.id === segmentId ? { ...s, startTime: constrainedStart, endTime: newEnd } : s
      ),
    });
  }
);

// Write atom: Save segment move to history (call after drag ends)
export const commitSegmentMoveAtom = atom(null, (get, set) => {
  const state = get(segmentsStateAtom);
  const history = get(segmentHistoryAtom);
  const index = get(segmentHistoryIndexAtom);

  // Only save if different from last history entry
  const lastEntry = history[index];
  if (lastEntry && JSON.stringify(lastEntry) === JSON.stringify(state.segments)) {
    return;
  }

  const newHistory = history.slice(0, index + 1);
  newHistory.push([...state.segments]);
  if (newHistory.length > 50) newHistory.shift();
  set(segmentHistoryAtom, newHistory);
  set(segmentHistoryIndexAtom, newHistory.length - 1);
});

// Write atom: Reorder segments (swap positions in array)
export const reorderSegmentsAtom = atom(
  null,
  (get, set, { fromIndex, toIndex }: { fromIndex: number; toIndex: number }) => {
    const state = get(segmentsStateAtom);
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= state.segments.length) return;
    if (toIndex < 0 || toIndex >= state.segments.length) return;

    // Save current state to history before making changes
    const history = get(segmentHistoryAtom);
    const index = get(segmentHistoryIndexAtom);
    const newHistory = history.slice(0, index + 1);
    newHistory.push([...state.segments]);
    if (newHistory.length > 50) newHistory.shift();
    set(segmentHistoryAtom, newHistory);
    set(segmentHistoryIndexAtom, newHistory.length - 1);

    // Create new array with reordered segments
    const newSegments = [...state.segments];
    const [removed] = newSegments.splice(fromIndex, 1);
    newSegments.splice(toIndex, 0, removed);

    set(segmentsStateAtom, {
      ...state,
      segments: newSegments,
    });
  }
);

// Write atom: Initialize segments (called when video loads)
export const initializeSegmentsAtom = atom(null, (get, set, duration: number) => {
  const initialSegment: Segment = {
    id: generateSegmentId(),
    startTime: 0,
    endTime: duration,
    speed: 1.0,
  };

  set(segmentsStateAtom, {
    segments: [initialSegment],
    selectedSegmentId: null,
  });

  // Initialize history with the initial state
  set(segmentHistoryAtom, [[initialSegment]]);
  set(segmentHistoryIndexAtom, 0);
});

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

// Final duration accounting for segments and their individual speeds
export const finalDurationAtom = atom((get) => {
  const activeSegments = get(activeSegmentsAtom);

  // If segments are initialized, calculate based on segments
  if (activeSegments.length > 0) {
    return activeSegments.reduce((total, segment) => {
      const segmentDuration = segment.endTime - segment.startTime;
      return total + segmentDuration / segment.speed;
    }, 0);
  }

  // Fallback to legacy trim/speed calculation
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
  const activeSegments = get(activeSegmentsAtom);

  const config: VideoEditConfig = {};

  // Check if segments have been modified (multiple segments, deleted segments, or non-1.0 speeds)
  const hasSegmentEdits =
    activeSegments.length > 1 ||
    activeSegments.some((s) => s.speed !== 1.0) ||
    activeSegments.some((s) => s.startTime > 0 || s.endTime < duration);

  if (hasSegmentEdits && activeSegments.length > 0) {
    // Include segments array for per-segment editing
    config.segments = activeSegments.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      speed: s.speed,
    }));

    // Also compute legacy trim for backward compatibility (overall bounds)
    const firstStart = Math.min(...activeSegments.map((s) => s.startTime));
    const lastEnd = Math.max(...activeSegments.map((s) => s.endTime));
    if (firstStart > 0 || lastEnd < duration) {
      config.trim = { startTime: firstStart, endTime: lastEnd };
    }
  } else {
    // Legacy: Only include trim if changed from full video
    if (trim.startTime > 0 || trim.endTime < duration) {
      config.trim = trim;
    }

    // Legacy: Only include speed if not 1.0
    if (speed !== 1.0) {
      config.speed = speed;
    }
  }

  // Only include crop if not default 9:16
  if (crop.aspectRatio !== "9:16" || crop.customCrop) {
    config.crop = crop;
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
