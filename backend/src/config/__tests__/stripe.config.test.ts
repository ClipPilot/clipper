import { describe, it, expect } from "vitest";
import {
  getPlanFromPriceId,
  getClipsLimitForPlan,
  isAddonPrice,
  getAddonClips,
  PLAN_LIMITS,
  STRIPE_PRICES,
} from "../stripe.config";

describe("PLAN_LIMITS", () => {
  it("has correct free tier limits", () => {
    expect(PLAN_LIMITS.FREE).toEqual({ clips: 3, generations: 10, seats: 1 });
  });

  it("has correct studio limits", () => {
    expect(PLAN_LIMITS.STUDIO).toEqual({ clips: 400, generations: -1, seats: 1 });
  });

  it("has correct scale limits", () => {
    expect(PLAN_LIMITS.SCALE).toEqual({ clips: 1000, generations: -1, seats: -1 });
  });

  it("has unlimited enterprise", () => {
    expect(PLAN_LIMITS.ENTERPRISE).toEqual({ clips: -1, generations: -1, seats: -1 });
  });

  it("has addon clip counts", () => {
    expect(PLAN_LIMITS.STUDIO_ADDON.clips).toBe(50);
    expect(PLAN_LIMITS.SCALE_ADDON.clips).toBe(100);
  });
});

describe("getPlanFromPriceId", () => {
  it("returns studio for studio price", () => {
    expect(getPlanFromPriceId(STRIPE_PRICES.STUDIO)).toBe("studio");
  });

  it("returns scale for scale price", () => {
    expect(getPlanFromPriceId(STRIPE_PRICES.SCALE)).toBe("scale");
  });

  it("returns studio_addon for studio addon price", () => {
    expect(getPlanFromPriceId(STRIPE_PRICES.STUDIO_ADDON)).toBe("studio_addon");
  });

  it("returns scale_addon for scale addon price", () => {
    expect(getPlanFromPriceId(STRIPE_PRICES.SCALE_ADDON)).toBe("scale_addon");
  });

  it("returns free for unknown price", () => {
    expect(getPlanFromPriceId("price_unknown")).toBe("free");
  });
});

describe("getClipsLimitForPlan", () => {
  it("returns 400 for studio", () => {
    expect(getClipsLimitForPlan("studio")).toBe(400);
  });

  it("returns 1000 for scale", () => {
    expect(getClipsLimitForPlan("scale")).toBe(1000);
  });

  it("returns -1 for enterprise (unlimited)", () => {
    expect(getClipsLimitForPlan("enterprise")).toBe(-1);
  });

  it("returns custom limit for enterprise when provided", () => {
    expect(getClipsLimitForPlan("enterprise", 5000)).toBe(5000);
  });

  it("ignores custom limit for non-enterprise plans", () => {
    expect(getClipsLimitForPlan("studio", 5000)).toBe(400);
  });

  it("returns 3 for free/unknown", () => {
    expect(getClipsLimitForPlan("free")).toBe(3);
    expect(getClipsLimitForPlan("unknown")).toBe(3);
  });
});

describe("isAddonPrice", () => {
  it("returns true for studio addon", () => {
    expect(isAddonPrice(STRIPE_PRICES.STUDIO_ADDON)).toBe(true);
  });

  it("returns true for scale addon", () => {
    expect(isAddonPrice(STRIPE_PRICES.SCALE_ADDON)).toBe(true);
  });

  it("returns false for regular plan price", () => {
    expect(isAddonPrice(STRIPE_PRICES.STUDIO)).toBe(false);
  });

  it("returns false for unknown price", () => {
    expect(isAddonPrice("price_unknown")).toBe(false);
  });
});

describe("getAddonClips", () => {
  it("returns 50 for studio addon", () => {
    expect(getAddonClips(STRIPE_PRICES.STUDIO_ADDON)).toBe(50);
  });

  it("returns 100 for scale addon", () => {
    expect(getAddonClips(STRIPE_PRICES.SCALE_ADDON)).toBe(100);
  });

  it("returns 0 for non-addon price", () => {
    expect(getAddonClips(STRIPE_PRICES.STUDIO)).toBe(0);
    expect(getAddonClips("price_unknown")).toBe(0);
  });
});
