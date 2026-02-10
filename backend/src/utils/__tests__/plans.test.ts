import { describe, it, expect } from "vitest";
import { isPaidPlan, canInviteMembers, canAccessUGCStudio } from "../plans";

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
