import type { TranscriptionWord } from "./captions.service";
import type { FacecamRegion } from "./videoEditor.service";
import type { SceneFaces } from "../facecamDetect.service";

export interface ActiveSpeakerSegment {
  speaker: number;
  start: number;
  end: number;
  face?: FacecamRegion;
}

/**
 * Merge gap between consecutive same-speaker segments if shorter than this.
 * Prevents rapid cuts during brief pauses in speech.
 */
const MERGE_GAP_THRESHOLD = 0.5;

/**
 * Build speaker segments from diarized transcription words.
 *
 * Groups consecutive same-speaker words into segments.
 * Merges segments from the same speaker when the gap between them is < 0.5s.
 *
 * @param words - Transcription words with speaker IDs from Deepgram diarization
 * @returns Array of speaker segments sorted chronologically
 */
export function buildSpeakerSegments(
  words: TranscriptionWord[]
): ActiveSpeakerSegment[] {
  const diarized = words.filter(
    (w): w is TranscriptionWord & { speaker: number } =>
      w.speaker !== undefined && w.speaker !== null
  );

  if (diarized.length === 0) return [];

  // Pass 1: Group consecutive same-speaker words into raw segments
  const raw: ActiveSpeakerSegment[] = [];
  let current: ActiveSpeakerSegment = {
    speaker: diarized[0].speaker,
    start: diarized[0].start,
    end: diarized[0].end,
  };

  for (let i = 1; i < diarized.length; i++) {
    const w = diarized[i];
    if (w.speaker === current.speaker) {
      current.end = w.end;
    } else {
      raw.push(current);
      current = { speaker: w.speaker, start: w.start, end: w.end };
    }
  }
  raw.push(current);

  // Pass 2: Merge adjacent same-speaker segments with gap < threshold
  const merged: ActiveSpeakerSegment[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const prev = merged[merged.length - 1];
    const seg = raw[i];
    if (seg.speaker === prev.speaker && seg.start - prev.end < MERGE_GAP_THRESHOLD) {
      prev.end = seg.end;
    } else {
      merged.push(seg);
    }
  }

  return merged;
}

/**
 * Map speaker IDs to face regions by spatial order (left-to-right).
 *
 * Speaker 0 → leftmost face, Speaker 1 → next face, etc.
 * If there are more speakers than faces, extra speakers map to the last face.
 *
 * @param speakerIds - Unique speaker IDs from diarization (e.g., [0, 1])
 * @param faces - Face regions detected by Lambda, already sorted left-to-right
 * @returns Map from speaker ID to face region
 */
/**
 * Resolve per-segment face regions using scene-aware face data.
 *
 * For each speaker segment, finds which scene contains it, then maps
 * that segment's speaker to the correct face within that scene.
 *
 * @param segments - Speaker segments from diarization
 * @param scenes - Per-scene face data from multi-face Lambda
 * @returns New segments array with `face` populated where possible
 */
export function resolveSegmentFaces(
  segments: ActiveSpeakerSegment[],
  scenes: SceneFaces[]
): ActiveSpeakerSegment[] {
  const findScene = (time: number) =>
    scenes.find((s) => time >= s.start && time <= s.end) ?? null;

  // Group segments by their scene to build per-scene speaker lists
  const sceneSegments = new Map<SceneFaces, ActiveSpeakerSegment[]>();
  for (const seg of segments) {
    const mid = (seg.start + seg.end) / 2;
    const scene = findScene(mid);
    if (!scene || scene.faceCount === 0) continue;
    const list = sceneSegments.get(scene) ?? [];
    list.push(seg);
    sceneSegments.set(scene, list);
  }

  // Build per-scene speaker→face maps
  const sceneFaceMaps = new Map<SceneFaces, Map<number, FacecamRegion>>();
  for (const [scene, segs] of sceneSegments) {
    const speakers = [...new Set(segs.map((s) => s.speaker))].sort((a, b) => a - b);
    const faceMap = new Map<number, FacecamRegion>();
    for (let i = 0; i < speakers.length; i++) {
      faceMap.set(speakers[i], scene.faces[Math.min(i, scene.faces.length - 1)]);
    }
    sceneFaceMaps.set(scene, faceMap);
  }

  return segments.map((seg) => {
    const scene = findScene((seg.start + seg.end) / 2);
    if (!scene) return seg;
    const faceMap = sceneFaceMaps.get(scene);
    const face = faceMap?.get(seg.speaker);
    return face ? { ...seg, face } : seg;
  });
}

export function mapSpeakersToFaces(
  speakerIds: number[],
  faces: FacecamRegion[]
): Map<number, FacecamRegion> {
  const sorted = [...speakerIds].sort((a, b) => a - b);
  const mapping = new Map<number, FacecamRegion>();

  for (let i = 0; i < sorted.length; i++) {
    // Clamp to last face if more speakers than faces
    const faceIndex = Math.min(i, faces.length - 1);
    mapping.set(sorted[i], faces[faceIndex]);
  }

  return mapping;
}
