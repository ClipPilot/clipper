import { describe, it, expect } from "vitest";
import {
  generateUniquifyParams,
  generateUniquifyString,
  UniquifyParams,
} from "../videoUniquify";

describe("generateUniquifyParams", () => {
  it("returns all required fields", () => {
    const params = generateUniquifyParams();
    const keys: (keyof UniquifyParams)[] = [
      "cropLeft", "cropRight", "cropTop", "cropBottom",
      "noiseStrength", "hueShift", "saturation", "brightness",
      "speed", "crf", "audioPitch", "trimOffset",
    ];
    for (const key of keys) {
      expect(params[key]).toBeDefined();
      expect(typeof params[key]).toBe("number");
    }
  });

  it("generates crop values within 0.03–0.07", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateUniquifyParams();
      for (const edge of [p.cropLeft, p.cropRight, p.cropTop, p.cropBottom]) {
        expect(edge).toBeGreaterThanOrEqual(0.03);
        expect(edge).toBeLessThan(0.07 + 0.001);
      }
    }
  });

  it("generates noiseStrength as integer 5–10", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateUniquifyParams();
      expect(Number.isInteger(p.noiseStrength)).toBe(true);
      expect(p.noiseStrength).toBeGreaterThanOrEqual(5);
      expect(p.noiseStrength).toBeLessThanOrEqual(10);
    }
  });

  it("generates hueShift within -5 to +5", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateUniquifyParams();
      expect(p.hueShift).toBeGreaterThanOrEqual(-5);
      expect(p.hueShift).toBeLessThanOrEqual(5);
    }
  });

  it("generates saturation within 0.95–1.05", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateUniquifyParams();
      expect(p.saturation).toBeGreaterThanOrEqual(0.95);
      expect(p.saturation).toBeLessThan(1.05 + 0.001);
    }
  });

  it("generates brightness within -0.03 to +0.03", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateUniquifyParams();
      expect(p.brightness).toBeGreaterThanOrEqual(-0.03);
      expect(p.brightness).toBeLessThanOrEqual(0.03 + 0.001);
    }
  });

  it("generates speed within 0.97–1.03", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateUniquifyParams();
      expect(p.speed).toBeGreaterThanOrEqual(0.97);
      expect(p.speed).toBeLessThan(1.03 + 0.001);
    }
  });

  it("generates crf as integer 17–21", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateUniquifyParams();
      expect(Number.isInteger(p.crf)).toBe(true);
      expect(p.crf).toBeGreaterThanOrEqual(17);
      expect(p.crf).toBeLessThanOrEqual(21);
    }
  });

  it("generates audioPitch within 0.97–1.03", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateUniquifyParams();
      expect(p.audioPitch).toBeGreaterThanOrEqual(0.97);
      expect(p.audioPitch).toBeLessThan(1.03 + 0.001);
    }
  });

  it("generates trimOffset within 0–0.5", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateUniquifyParams();
      expect(p.trimOffset).toBeGreaterThanOrEqual(0);
      expect(p.trimOffset).toBeLessThan(0.5 + 0.001);
    }
  });

  it("produces different params across calls", () => {
    const crfs = new Set<number>();
    const hues = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const p = generateUniquifyParams();
      crfs.add(p.crf);
      hues.add(Math.round(p.hueShift * 100));
    }
    expect(crfs.size).toBeGreaterThan(1);
    expect(hues.size).toBeGreaterThan(1);
  });
});

describe("generateUniquifyString", () => {
  const fixedParams: UniquifyParams = {
    cropLeft: 0.05,
    cropRight: 0.04,
    cropTop: 0.06,
    cropBottom: 0.03,
    noiseStrength: 7,
    hueShift: 3,
    saturation: 1.02,
    brightness: -0.01,
    speed: 1.01,
    crf: 19,
    audioPitch: 0.98,
    trimOffset: 0.25,
  };

  it("returns filterComplex, encodingArgs, and fullArgs strings", () => {
    const result = generateUniquifyString(fixedParams);
    expect(typeof result.filterComplex).toBe("string");
    expect(typeof result.encodingArgs).toBe("string");
    expect(typeof result.fullArgs).toBe("string");
  });

  it("includes all video filter stages in filterComplex", () => {
    const { filterComplex } = generateUniquifyString(fixedParams);
    expect(filterComplex).toContain("crop=");
    expect(filterComplex).toContain("pad=");
    expect(filterComplex).toContain("noise=");
    expect(filterComplex).toContain("hue=");
    expect(filterComplex).toContain("eq=");
    expect(filterComplex).toContain("setpts=");
  });

  it("includes audio filter stages in filterComplex", () => {
    const { filterComplex } = generateUniquifyString(fixedParams);
    expect(filterComplex).toContain("atempo=");
    expect(filterComplex).toContain("asetrate=");
    expect(filterComplex).toContain("aresample=");
  });

  it("uses libx264 encoding, not -c copy", () => {
    const { fullArgs } = generateUniquifyString(fixedParams);
    expect(fullArgs).toContain("-c:v libx264");
    expect(fullArgs).not.toContain("-c copy");
    expect(fullArgs).not.toContain("-c:v copy");
  });

  it("includes trim offset via -ss", () => {
    const { fullArgs } = generateUniquifyString(fixedParams);
    expect(fullArgs).toContain(`-ss ${fixedParams.trimOffset}`);
  });

  it("strips original metadata with -map_metadata -1", () => {
    const { fullArgs } = generateUniquifyString(fixedParams);
    expect(fullArgs).toContain("-map_metadata -1");
  });

  it("includes -movflags +faststart for streaming", () => {
    const { fullArgs } = generateUniquifyString(fixedParams);
    expect(fullArgs).toContain("-movflags +faststart");
  });

  it("includes fake device metadata", () => {
    const { fullArgs } = generateUniquifyString(fixedParams);
    expect(fullArgs).toContain("-metadata make=");
    expect(fullArgs).toContain("-metadata model=");
    expect(fullArgs).toContain("-metadata creation_time=");
  });

  it("embeds the correct CRF value", () => {
    const { fullArgs } = generateUniquifyString(fixedParams);
    expect(fullArgs).toContain(`-crf ${fixedParams.crf}`);
  });

  it("maps video and audio filter outputs", () => {
    const { fullArgs } = generateUniquifyString(fixedParams);
    expect(fullArgs).toContain('-map "[v]"');
    expect(fullArgs).toContain('-map "[a]"');
  });

  it("produces different output on each call without params", () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(generateUniquifyString().fullArgs);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
