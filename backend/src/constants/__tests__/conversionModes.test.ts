import { describe, it, expect } from "vitest";
import { CONVERSION_MODES, isValidConversionMode } from "../conversionModes";

describe("conversionModes", () => {
  it("includes active-speaker mode", () => {
    expect(CONVERSION_MODES).toContain("active-speaker");
  });

  it("includes all expected modes", () => {
    expect(CONVERSION_MODES).toEqual([
      "standard",
      "gaming",
      "speaker-zoom",
      "center-crop",
      "active-speaker",
    ]);
  });

  it("validates active-speaker as valid mode", () => {
    expect(isValidConversionMode("active-speaker")).toBe(true);
  });

  it("rejects invalid modes", () => {
    expect(isValidConversionMode("invalid")).toBe(false);
  });
});
