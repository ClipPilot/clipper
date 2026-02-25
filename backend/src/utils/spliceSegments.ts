export interface SegmentInput {
  start: number;
  end: number;
}

export interface SpliceSegment {
  start: number;
  end: number;
  type: "processed" | "original";
  chunkCount?: number;
}

export function calculateSpliceSegments(
  segments: SegmentInput[],
  videoDuration: number,
): SpliceSegment[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const result: SpliceSegment[] = [];

  if (sorted[0].start > 0.1) {
    result.push({ start: 0, end: sorted[0].start, type: "original" });
  }

  for (let i = 0; i < sorted.length; i++) {
    result.push({
      start: sorted[i].start,
      end: sorted[i].end,
      type: "processed",
    });
    if (i < sorted.length - 1 && sorted[i].end < sorted[i + 1].start - 0.1) {
      result.push({
        start: sorted[i].end,
        end: sorted[i + 1].start,
        type: "original",
      });
    }
  }

  if (sorted[sorted.length - 1].end < videoDuration - 0.1) {
    result.push({
      start: sorted[sorted.length - 1].end,
      end: videoDuration,
      type: "original",
    });
  }

  return result;
}
