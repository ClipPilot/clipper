import { describe, it, expect } from "vitest";
import {
  buildSpeakerSegments,
  mapSpeakersToFaces,
} from "../speakerSegments.service";
import type { TranscriptionWord } from "../captions.service";
import type { FacecamRegion } from "../videoEditor.service";

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
