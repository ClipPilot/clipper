import { describe, it, expect } from "vitest";
import {
  buildSpeakerSegments,
  mapSpeakersToFaces,
  splitSegmentsAtSceneBoundaries,
  resolveSegmentFaces,
} from "../speakerSegments.service";
import type { TranscriptionWord } from "../captions.service";
import type { FacecamRegion } from "../videoEditor.service";
import type { SceneFaces } from "../../facecamDetect.service";

describe("buildSpeakerSegments", () => {
  it("returns empty array when no words have speaker data", () => {
    const words: TranscriptionWord[] = [
      { start: 0, end: 1, punctuated_word: "Hello" },
      { start: 1, end: 2, punctuated_word: "world" },
    ];
    expect(buildSpeakerSegments(words)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(buildSpeakerSegments([])).toEqual([]);
  });

  it("groups consecutive same-speaker words into one segment", () => {
    const words: TranscriptionWord[] = [
      { start: 0, end: 0.5, punctuated_word: "Hello", speaker: 0 },
      { start: 0.5, end: 1.0, punctuated_word: "there", speaker: 0 },
      { start: 1.0, end: 1.5, punctuated_word: "friend", speaker: 0 },
    ];
    const result = buildSpeakerSegments(words);
    expect(result).toEqual([{ speaker: 0, start: 0, end: 1.5 }]);
  });

  it("creates separate segments when speaker changes", () => {
    const words: TranscriptionWord[] = [
      { start: 0, end: 1, punctuated_word: "Hi", speaker: 0 },
      { start: 1, end: 2, punctuated_word: "Hey", speaker: 1 },
      { start: 2, end: 3, punctuated_word: "Sup", speaker: 0 },
    ];
    const result = buildSpeakerSegments(words);
    expect(result).toEqual([
      { speaker: 0, start: 0, end: 1 },
      { speaker: 1, start: 1, end: 2 },
      { speaker: 0, start: 2, end: 3 },
    ]);
  });

  it("merges same-speaker segments with gap < 0.5s", () => {
    const words: TranscriptionWord[] = [
      { start: 0, end: 1, punctuated_word: "Hi", speaker: 0 },
      { start: 1, end: 2, punctuated_word: "Hey", speaker: 1 },
      { start: 2, end: 2.3, punctuated_word: "Ok", speaker: 0 },
      // Gap of 0.2s — should merge with the next speaker 0 segment
      { start: 2.5, end: 3, punctuated_word: "cool", speaker: 0 },
    ];
    const result = buildSpeakerSegments(words);
    expect(result).toEqual([
      { speaker: 0, start: 0, end: 1 },
      { speaker: 1, start: 1, end: 2 },
      { speaker: 0, start: 2, end: 3 },
    ]);
  });

  it("does NOT merge same-speaker segments separated by different speaker with gap >= 0.5s", () => {
    const words: TranscriptionWord[] = [
      { start: 0, end: 1, punctuated_word: "Hello", speaker: 0 },
      { start: 1, end: 2, punctuated_word: "Hey", speaker: 1 },
      // Gap of 1s between speaker 1 ending and speaker 0 resuming — should NOT merge
      { start: 3, end: 4, punctuated_word: "So", speaker: 0 },
    ];
    const result = buildSpeakerSegments(words);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ speaker: 0, start: 0, end: 1 });
    expect(result[1]).toEqual({ speaker: 1, start: 1, end: 2 });
    expect(result[2]).toEqual({ speaker: 0, start: 3, end: 4 });
  });

  it("skips words without speaker data", () => {
    const words: TranscriptionWord[] = [
      { start: 0, end: 1, punctuated_word: "Hi", speaker: 0 },
      { start: 1, end: 2, punctuated_word: "um" }, // no speaker
      { start: 2, end: 3, punctuated_word: "Ok", speaker: 1 },
    ];
    const result = buildSpeakerSegments(words);
    expect(result).toEqual([
      { speaker: 0, start: 0, end: 1 },
      { speaker: 1, start: 2, end: 3 },
    ]);
  });

  it("handles single word", () => {
    const words: TranscriptionWord[] = [
      { start: 5, end: 6, punctuated_word: "Hello", speaker: 0 },
    ];
    const result = buildSpeakerSegments(words);
    expect(result).toEqual([{ speaker: 0, start: 5, end: 6 }]);
  });
});

describe("mapSpeakersToFaces", () => {
  const leftFace: FacecamRegion = { x: 100, y: 200, w: 80, h: 80 };
  const rightFace: FacecamRegion = { x: 500, y: 200, w: 80, h: 80 };

  it("maps speaker 0 to leftmost face, speaker 1 to rightmost", () => {
    const result = mapSpeakersToFaces([0, 1], [leftFace, rightFace]);
    expect(result.get(0)).toBe(leftFace);
    expect(result.get(1)).toBe(rightFace);
  });

  it("maps speakers in sorted order regardless of input order", () => {
    const result = mapSpeakersToFaces([1, 0], [leftFace, rightFace]);
    expect(result.get(0)).toBe(leftFace);
    expect(result.get(1)).toBe(rightFace);
  });

  it("clamps extra speakers to last face", () => {
    const result = mapSpeakersToFaces([0, 1, 2], [leftFace, rightFace]);
    expect(result.get(0)).toBe(leftFace);
    expect(result.get(1)).toBe(rightFace);
    expect(result.get(2)).toBe(rightFace); // clamped
  });

  it("handles single face with multiple speakers", () => {
    const result = mapSpeakersToFaces([0, 1], [leftFace]);
    expect(result.get(0)).toBe(leftFace);
    expect(result.get(1)).toBe(leftFace);
  });

  it("handles single speaker", () => {
    const result = mapSpeakersToFaces([0], [leftFace, rightFace]);
    expect(result.get(0)).toBe(leftFace);
  });
});

describe("splitSegmentsAtSceneBoundaries", () => {
  const makeScene = (
    start: number,
    end: number,
    faceCount = 1
  ): SceneFaces => ({
    start,
    end,
    faces: Array.from({ length: faceCount }, (_, i) => ({
      x: 100 + i * 200,
      y: 100,
      w: 80,
      h: 80,
    })),
    faceCount,
  });

  it("passes through segment entirely within one scene", () => {
    const segments = [{ speaker: 0, start: 2, end: 5 }];
    const scenes = [makeScene(0, 10)];
    const result = splitSegmentsAtSceneBoundaries(segments, scenes);
    expect(result).toEqual([{ speaker: 0, start: 2, end: 5 }]);
  });

  it("splits segment spanning 2 scenes at the boundary", () => {
    const segments = [{ speaker: 0, start: 8, end: 14 }];
    const scenes = [makeScene(0, 10), makeScene(10, 20)];
    const result = splitSegmentsAtSceneBoundaries(segments, scenes);
    expect(result).toEqual([
      { speaker: 0, start: 8, end: 10 },
      { speaker: 0, start: 10, end: 14 },
    ]);
  });

  it("splits segment spanning 3+ scenes at all boundaries", () => {
    const segments = [{ speaker: 1, start: 5, end: 25 }];
    const scenes = [makeScene(0, 10), makeScene(10, 20), makeScene(20, 30)];
    const result = splitSegmentsAtSceneBoundaries(segments, scenes);
    expect(result).toEqual([
      { speaker: 1, start: 5, end: 10 },
      { speaker: 1, start: 10, end: 20 },
      { speaker: 1, start: 20, end: 25 },
    ]);
  });

  it("does not split when segment starts or ends exactly on boundary", () => {
    const segments = [{ speaker: 0, start: 10, end: 20 }];
    const scenes = [makeScene(0, 10), makeScene(10, 20), makeScene(20, 30)];
    const result = splitSegmentsAtSceneBoundaries(segments, scenes);
    // Boundaries at 10 and 20 are not strictly inside (10, 20), so no split
    expect(result).toEqual([{ speaker: 0, start: 10, end: 20 }]);
  });

  it("discards sub-segments shorter than 0.1s", () => {
    const segments = [{ speaker: 0, start: 9.95, end: 10.5 }];
    const scenes = [makeScene(0, 10), makeScene(10, 20)];
    const result = splitSegmentsAtSceneBoundaries(segments, scenes);
    // First sub-segment 9.95–10 = 0.05s < 0.1s → discarded
    expect(result).toEqual([{ speaker: 0, start: 10, end: 10.5 }]);
  });

  it("passes through segment in gap between scenes", () => {
    const segments = [{ speaker: 0, start: 12, end: 18 }];
    const scenes = [makeScene(0, 10), makeScene(20, 30)];
    const result = splitSegmentsAtSceneBoundaries(segments, scenes);
    // No boundaries fall inside (12, 18)
    expect(result).toEqual([{ speaker: 0, start: 12, end: 18 }]);
  });

  it("returns segments unchanged when scenes array is empty", () => {
    const segments = [
      { speaker: 0, start: 0, end: 5 },
      { speaker: 1, start: 5, end: 10 },
    ];
    const result = splitSegmentsAtSceneBoundaries(segments, []);
    expect(result).toEqual(segments);
  });

  it("handles multiple segments with mixed splitting", () => {
    const segments = [
      { speaker: 0, start: 2, end: 5 }, // within scene 1 → no split
      { speaker: 1, start: 8, end: 14 }, // crosses scene boundary at 10
      { speaker: 0, start: 15, end: 18 }, // within scene 2 → no split
    ];
    const scenes = [makeScene(0, 10), makeScene(10, 20)];
    const result = splitSegmentsAtSceneBoundaries(segments, scenes);
    expect(result).toEqual([
      { speaker: 0, start: 2, end: 5 },
      { speaker: 1, start: 8, end: 10 },
      { speaker: 1, start: 10, end: 14 },
      { speaker: 0, start: 15, end: 18 },
    ]);
  });
});

describe("resolveSegmentFaces - cross-scene integration", () => {
  const faceA: FacecamRegion = { x: 100, y: 100, w: 80, h: 80 };
  const faceB: FacecamRegion = { x: 500, y: 100, w: 80, h: 80 };

  it("assigns correct face per sub-segment when segment crosses scene boundary", () => {
    // Scene 1 (0–10s): faceA on the left
    // Scene 2 (10–20s): faceB on the left (camera angle changed)
    const scenes: SceneFaces[] = [
      { start: 0, end: 10, faces: [faceA], faceCount: 1 },
      { start: 10, end: 20, faces: [faceB], faceCount: 1 },
    ];

    // Speaker 0 talks across the scene cut
    const segments = [{ speaker: 0, start: 8, end: 14 }];

    const result = resolveSegmentFaces(segments, scenes);

    // Should be split into two sub-segments, each with the correct face
    expect(result).toEqual([
      { speaker: 0, start: 8, end: 10, face: faceA },
      { speaker: 0, start: 10, end: 14, face: faceB },
    ]);
  });

  it("preserves segments that don't cross boundaries with correct faces", () => {
    const scenes: SceneFaces[] = [
      { start: 0, end: 10, faces: [faceA], faceCount: 1 },
      { start: 10, end: 20, faces: [faceB], faceCount: 1 },
    ];

    const segments = [
      { speaker: 0, start: 2, end: 5 },
      { speaker: 0, start: 12, end: 18 },
    ];

    const result = resolveSegmentFaces(segments, scenes);

    expect(result).toEqual([
      { speaker: 0, start: 2, end: 5, face: faceA },
      { speaker: 0, start: 12, end: 18, face: faceB },
    ]);
  });

  it("leaves segments without a matching scene unchanged", () => {
    const scenes: SceneFaces[] = [
      { start: 0, end: 10, faces: [faceA], faceCount: 1 },
    ];

    // This segment is in a gap — no scene covers 15–20
    const segments = [{ speaker: 0, start: 15, end: 20 }];

    const result = resolveSegmentFaces(segments, scenes);

    expect(result).toEqual([{ speaker: 0, start: 15, end: 20 }]);
  });
});
