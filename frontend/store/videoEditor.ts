"use client";

import { atom } from "jotai";
import { CaptionEntry, Clip } from "@/api/clips";

// Editor tool types
export type EditorTool = "trim" | "crop" | "speed" | "audio" | "captions" | "heading" | "overlay";

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
export type HeadingStyle = "stroke" | "instagram";

export interface HeadingState {
  text: string;
  color: string;
  font: string;
  x: number;
  y: number;
  fontSize: number;
  style: HeadingStyle;
  headingBgColor?: string;
}

// Comment overlay types
export type CommentPlatform = "tiktok" | "youtube" | "instagram";

export interface CommentOverlayData {
  platform: CommentPlatform;
  username: string;
  commentText: string;
  profilePictureUrl?: string; // Blob URL for preview
  profilePictureS3Key?: string; // S3 key after upload
  likesCount: number;
  isVerified: boolean;
  timeAgo?: string; // e.g. "2h", "1d"
}

// Media overlay state
export interface MediaOverlay {
  id: string;
  type: "image" | "video" | "comment";
  s3Key: string;
  fileName: string;
  url: string; // Blob URL for preview
  startTime: number;
  endTime: number;
  x: number; // Position as percentage (0-100)
  y: number;
  scale: number; // 0.1-2.0
  opacity: number; // 0-1
  naturalWidth: number;
  naturalHeight: number;
  commentData?: CommentOverlayData; // Only present when type === "comment"
}

// Media overlay config for API submission (no blob URLs)
export interface MediaOverlayConfig {
  id: string;
  type: "image" | "video" | "comment";
  s3Key: string;
  fileName: string;
  startTime: number;
  endTime: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  naturalWidth: number;
  naturalHeight: number;
  commentData?: {
    platform: CommentPlatform;
    username: string;
    commentText: string;
    profilePictureS3Key?: string;
    likesCount: number;
    isVerified: boolean;
    timeAgo?: string;
  };
}

export const generateOverlayId = (): string =>
  `overlay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

export const generateSegmentId = (): SegmentId =>
  `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
  overlays?: MediaOverlayConfig[];
}

// =============================================================================
// Core Atoms
// =============================================================================

export const editorClipAtom = atom<Clip | null>(null);
export const editorLoadingAtom = atom<boolean>(true);
export const editorAccessDeniedAtom = atom<boolean>(false);

export const videoDurationAtom = atom<number>(0);
export const currentTimeAtom = atom<number>(0);
export const isPlayingAtom = atom<boolean>(false);

export const activeToolAtom = atom<EditorTool>("trim");

// =============================================================================
// Tool State Atoms
// =============================================================================

export const trimStateAtom = atom<TrimState>({
  startTime: 0,
  endTime: 0,
});

export const cropStateAtom = atom<CropState>({
  aspectRatio: "9:16",
});

// 1.0 = normal playback; valid range 0.25-4.0
export const speedStateAtom = atom<number>(1.0);

export const audioStateAtom = atom<AudioState>({
  originalVolume: 1,
  originalMuted: false,
});

export const captionsEnabledAtom = atom<boolean>(true);
export const captionsDataAtom = atom<CaptionEntry[]>([]);
export const captionColorAtom = atom<string>("#FFD600");
export const captionFontAtom = atom<string>("Luckiest Guy");

export const headingStateAtom = atom<HeadingState | null>(null);

export const mediaOverlaysAtom = atom<MediaOverlay[]>([]);
export const selectedOverlayIdAtom = atom<string | null>(null);
export const selectedOverlayAtom = atom((get) => {
  const overlays = get(mediaOverlaysAtom);
  const selectedId = get(selectedOverlayIdAtom);
  if (!selectedId) return null;
  return overlays.find((o) => o.id === selectedId) || null;
});

// =============================================================================
// Segment Atoms
// =============================================================================

export const segmentsStateAtom = atom<SegmentsState>({
  segments: [],
  selectedSegmentId: null,
});

// History for undo/redo (stores previous segment states)
export const segmentHistoryAtom = atom<Segment[][]>([]);
export const segmentHistoryIndexAtom = atom<number>(-1);

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

export const canUndoAtom = atom((get) => {
  const index = get(segmentHistoryIndexAtom);
  return index > 0;
});

export const canRedoAtom = atom((get) => {
  const history = get(segmentHistoryAtom);
  const index = get(segmentHistoryIndexAtom);
  return index < history.length - 1;
});

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

export const splitSegmentAtom = atom(null, (get, set, splitTime: number) => {
  const state = get(segmentsStateAtom);
  const segmentToSplit = state.segments.find(
    (s) => splitTime > s.startTime + 0.1 && splitTime < s.endTime - 0.1
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

export const selectSegmentAtom = atom(null, (get, set, segmentId: SegmentId | null) => {
  const state = get(segmentsStateAtom);
  set(segmentsStateAtom, {
    ...state,
    selectedSegmentId: segmentId,
  });
});

// Speed updates skip history — changes are too frequent to record individually
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

export const updateAllSegmentsSpeedAtom = atom(null, (get, set, speed: number) => {
  const state = get(segmentsStateAtom);

  set(segmentsStateAtom, {
    ...state,
    segments: state.segments.map((s) => ({ ...s, speed })),
  });
});

// Trim during drag skips history — commit is done on drag end via commitSegmentMoveAtom
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

    // Ensure minimum duration of 0.1s
    if (newEnd - newStart < 0.1) return;

    set(segmentsStateAtom, {
      ...state,
      segments: state.segments.map((s) =>
        s.id === segmentId ? { ...s, startTime: newStart, endTime: newEnd } : s
      ),
    });
  }
);

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

export const captionsStateAtom = atom((get) => ({
  enabled: get(captionsEnabledAtom),
  data: get(captionsDataAtom),
  color: get(captionColorAtom),
  font: get(captionFontAtom),
}));

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

  // Include overlays if any exist
  const overlays = get(mediaOverlaysAtom);
  if (overlays.length > 0) {
    config.overlays = overlays
      .filter((o) => o.s3Key || o.type === "comment") // Include uploaded overlays and comment overlays
      .map(({ id, type, s3Key, fileName, startTime, endTime, x, y, scale, opacity, naturalWidth, naturalHeight, commentData }) => ({
        id, type, s3Key, fileName, startTime, endTime, x, y, scale, opacity, naturalWidth, naturalHeight,
        ...(type === "comment" && commentData ? {
          commentData: {
            platform: commentData.platform,
            username: commentData.username,
            commentText: commentData.commentText,
            profilePictureS3Key: commentData.profilePictureS3Key,
            likesCount: commentData.likesCount,
            isVerified: commentData.isVerified,
            timeAgo: commentData.timeAgo,
          },
        } : {}),
      }));
  }

  return config;
});

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
  const hasOverlays = config.overlays !== undefined && config.overlays.length > 0;

  return hasTrim || hasCrop || hasSpeed || hasAudio || hasHeading || hasOverlays;
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
