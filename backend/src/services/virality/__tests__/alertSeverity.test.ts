import { describe, it, expect } from "vitest";
import {
  computeAlertSeverity,
  deriveSnapshotSeverity,
  deriveSnapshotType,
  type ViralPostSnapshot,
} from "@clipper/shared-ui/utils/alertSeverity";

const BASE_SETTINGS = {
  owned_percent_threshold: 50,
  owned_absolute_threshold: 10_000,
  competitor_percent_threshold: 50,
  competitor_absolute_threshold: 10_000,
};

function makePost(overrides: Partial<ViralPostSnapshot> = {}): ViralPostSnapshot {
  return {
    postId: 1,
    postUrl: "https://tiktok.com/@test/1",
    thumbnailUrl: null,
    caption: null,
    platform: "tiktok",
    accountHandle: "test",
    groupName: "Group A",
    isCompetitor: true,
    currentViews: 100_000,
    previousViews: 50_000,
    viewsIncrease: 50_000,
    percentIncrease: 100,
    likeCount: 5_000,
    commentCount: 200,
    ...overrides,
  };
}

describe("computeAlertSeverity", () => {
  const settings = { percent_threshold: 50, absolute_threshold: 10_000 };

  it("returns high when percent >= 3x threshold AND views >= 2x absolute", () => {
    expect(computeAlertSeverity(150, 20_000, settings)).toBe("high");
    expect(computeAlertSeverity(150, 9_999, settings)).not.toBe("high");
    expect(computeAlertSeverity(149, 20_000, settings)).not.toBe("high");
  });

  it("returns medium when percent >= 1.5x threshold OR views >= absolute", () => {
    expect(computeAlertSeverity(75, 5_000, settings)).toBe("medium");
    expect(computeAlertSeverity(10, 10_000, settings)).toBe("medium");
  });

  it("returns low when below both thresholds", () => {
    expect(computeAlertSeverity(10, 1_000, settings)).toBe("low");
    expect(computeAlertSeverity(0, 0, settings)).toBe("low");
  });
});

describe("deriveSnapshotSeverity", () => {
  it("returns low for empty posts array", () => {
    expect(deriveSnapshotSeverity([], BASE_SETTINGS)).toBe("low");
  });

  it("escalates to highest severity across posts", () => {
    const low = makePost({ percentIncrease: 10, viewsIncrease: 1_000 });
    const high = makePost({ percentIncrease: 200, viewsIncrease: 25_000 });
    expect(deriveSnapshotSeverity([low, high], BASE_SETTINGS)).toBe("high");
  });

  it("uses competitor thresholds for competitor posts", () => {
    const settings = {
      ...BASE_SETTINGS,
      competitor_percent_threshold: 200,
      competitor_absolute_threshold: 50_000,
    };
    const post = makePost({ isCompetitor: true, percentIncrease: 100, viewsIncrease: 20_000 });
    expect(deriveSnapshotSeverity([post], settings)).toBe("low");
  });

  it("uses owned thresholds for owned posts", () => {
    const settings = {
      ...BASE_SETTINGS,
      owned_percent_threshold: 10,
      owned_absolute_threshold: 1_000,
    };
    const post = makePost({ isCompetitor: false, percentIncrease: 75, viewsIncrease: 10_000 });
    expect(deriveSnapshotSeverity([post], settings)).toBe("high");
  });
});

describe("deriveSnapshotType", () => {
  it("returns Competitor when all posts are competitor", () => {
    expect(deriveSnapshotType([makePost({ isCompetitor: true })])).toBe("Competitor");
  });

  it("returns Owned when all posts are owned", () => {
    expect(deriveSnapshotType([makePost({ isCompetitor: false })])).toBe("Owned");
  });

  it("returns Mixed when posts are both types", () => {
    const posts = [makePost({ isCompetitor: true }), makePost({ isCompetitor: false })];
    expect(deriveSnapshotType(posts)).toBe("Mixed");
  });
});
