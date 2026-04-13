import { describe, it, expect } from "vitest";
import {
  isPaidPlan,
  canInviteMembers,
  canAccessUGCStudio,
  canAccessViralityTracker,
  isAnalyticsPlan,
  canTrackKeywords,
  getViralityAccountLimit,
} from "../plans";

describe("isPaidPlan", () => {
  it("returns true for studio", () => {
    expect(isPaidPlan("studio")).toBe(true);
  });

  it("returns true for scale", () => {
    expect(isPaidPlan("scale")).toBe(true);
  });

  it("returns true for enterprise", () => {
    expect(isPaidPlan("enterprise")).toBe(true);
  });

  it("returns false for free", () => {
    expect(isPaidPlan("free")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isPaidPlan(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isPaidPlan(null)).toBe(false);
  });

  it("returns false for unknown plan", () => {
    expect(isPaidPlan("premium")).toBe(false);
  });
});

describe("canInviteMembers", () => {
  it("returns true for scale", () => {
    expect(canInviteMembers("scale")).toBe(true);
  });

  it("returns true for enterprise", () => {
    expect(canInviteMembers("enterprise")).toBe(true);
  });

  it("returns false for studio", () => {
    expect(canInviteMembers("studio")).toBe(false);
  });

  it("returns false for free", () => {
    expect(canInviteMembers("free")).toBe(false);
  });

  it("returns false for null", () => {
    expect(canInviteMembers(null)).toBe(false);
  });
});

describe("canAccessUGCStudio", () => {
  it("returns true for all valid plans", () => {
    expect(canAccessUGCStudio("free")).toBe(true);
    expect(canAccessUGCStudio("studio")).toBe(true);
    expect(canAccessUGCStudio("scale")).toBe(true);
    expect(canAccessUGCStudio("enterprise")).toBe(true);
  });

  it("returns false for null/undefined", () => {
    expect(canAccessUGCStudio(null)).toBe(false);
    expect(canAccessUGCStudio(undefined)).toBe(false);
  });
});

describe("canAccessViralityTracker", () => {
  it("returns true for studio/scale/enterprise", () => {
    expect(canAccessViralityTracker("studio")).toBe(true);
    expect(canAccessViralityTracker("scale")).toBe(true);
    expect(canAccessViralityTracker("enterprise")).toBe(true);
  });

  it("returns true for all analytics plans", () => {
    expect(canAccessViralityTracker("analytics_starter")).toBe(true);
    expect(canAccessViralityTracker("analytics_pro")).toBe(true);
    expect(canAccessViralityTracker("analytics_business")).toBe(true);
  });

  it("returns false for free/creator", () => {
    expect(canAccessViralityTracker("free")).toBe(false);
    expect(canAccessViralityTracker("creator")).toBe(false);
  });
});

describe("isAnalyticsPlan", () => {
  it("returns true for analytics plans", () => {
    expect(isAnalyticsPlan("analytics_starter")).toBe(true);
    expect(isAnalyticsPlan("analytics_pro")).toBe(true);
    expect(isAnalyticsPlan("analytics_business")).toBe(true);
  });

  it("returns false for main platform plans", () => {
    expect(isAnalyticsPlan("studio")).toBe(false);
    expect(isAnalyticsPlan("scale")).toBe(false);
    expect(isAnalyticsPlan("enterprise")).toBe(false);
  });

  it("returns false for free/creator/null", () => {
    expect(isAnalyticsPlan("free")).toBe(false);
    expect(isAnalyticsPlan("creator")).toBe(false);
    expect(isAnalyticsPlan(null)).toBe(false);
  });
});

describe("canTrackKeywords", () => {
  it("returns true for analytics_business", () => {
    expect(canTrackKeywords("analytics_business")).toBe(true);
  });

  it("returns true for studio/scale/enterprise", () => {
    expect(canTrackKeywords("studio")).toBe(true);
    expect(canTrackKeywords("scale")).toBe(true);
    expect(canTrackKeywords("enterprise")).toBe(true);
  });

  it("returns false for analytics_starter and analytics_pro", () => {
    expect(canTrackKeywords("analytics_starter")).toBe(false);
    expect(canTrackKeywords("analytics_pro")).toBe(false);
  });

  it("returns false for free/creator", () => {
    expect(canTrackKeywords("free")).toBe(false);
    expect(canTrackKeywords("creator")).toBe(false);
  });
});

describe("getViralityAccountLimit", () => {
  it("returns fixed limits for analytics plans", () => {
    expect(getViralityAccountLimit("analytics_starter")).toBe(50);
    expect(getViralityAccountLimit("analytics_pro")).toBe(100);
    expect(getViralityAccountLimit("analytics_business")).toBe(250);
  });

  it("returns -1 (unlimited) for studio/scale/enterprise", () => {
    expect(getViralityAccountLimit("studio")).toBe(-1);
    expect(getViralityAccountLimit("scale")).toBe(-1);
    expect(getViralityAccountLimit("enterprise")).toBe(-1);
  });

  it("returns 0 for plans without virality access", () => {
    expect(getViralityAccountLimit("free")).toBe(0);
    expect(getViralityAccountLimit("creator")).toBe(0);
    expect(getViralityAccountLimit(null)).toBe(0);
    expect(getViralityAccountLimit(undefined)).toBe(0);
  });
});
