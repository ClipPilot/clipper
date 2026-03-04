import { describe, it, expect } from "vitest";
import {
  generateJumbledMetadata,
  generateJumbledMetadataString,
} from "../videoMetadata";

describe("generateJumbledMetadata", () => {
  it("returns an array of strings", () => {
    const result = generateJumbledMetadata();
    expect(Array.isArray(result)).toBe(true);
    result.forEach((item) => expect(typeof item).toBe("string"));
  });

  it("always includes make, model, creation_time, and location metadata", () => {
    const result = generateJumbledMetadata();

    // Flags come in pairs: -metadata:g, value=...
    const globalPairs: string[] = [];
    for (let i = 0; i < result.length; i++) {
      if (result[i] === "-metadata:g") {
        globalPairs.push(result[i + 1]);
      }
    }

    const keys = globalPairs.map((p) => p.split("=")[0]);
    expect(keys).toContain("make");
    expect(keys).toContain("model");
    expect(keys).toContain("creation_time");
    expect(keys).toContain("location");
    expect(keys).toContain("location-eng");
  });

  it("includes stream handler metadata for video and audio", () => {
    const result = generateJumbledMetadata();

    expect(result).toContain("-metadata:s:v:0");
    expect(result).toContain("-metadata:s:a:0");
  });

  it("uses Apple handler names when device is Apple", () => {
    // Run many times to hit an Apple device
    let foundApple = false;
    for (let i = 0; i < 100; i++) {
      const result = generateJumbledMetadata();
      const videoIdx = result.indexOf("-metadata:s:v:0");
      const handlerValue = result[videoIdx + 1];
      if (handlerValue === "handler_name=Core Media Video") {
        foundApple = true;
        const audioIdx = result.indexOf("-metadata:s:a:0");
        expect(result[audioIdx + 1]).toBe("handler_name=Core Media Audio");
        break;
      }
    }
    expect(foundApple).toBe(true);
  });

  it("uses generic handler names when device is not Apple", () => {
    let foundNonApple = false;
    for (let i = 0; i < 100; i++) {
      const result = generateJumbledMetadata();
      const videoIdx = result.indexOf("-metadata:s:v:0");
      const handlerValue = result[videoIdx + 1];
      if (handlerValue === "handler_name=VideoHandler") {
        foundNonApple = true;
        const audioIdx = result.indexOf("-metadata:s:a:0");
        expect(result[audioIdx + 1]).toBe("handler_name=SoundHandler");
        break;
      }
    }
    expect(foundNonApple).toBe(true);
  });

  it("generates creation_time as ISO-8601 date", () => {
    const result = generateJumbledMetadata();
    const globalPairs: string[] = [];
    for (let i = 0; i < result.length; i++) {
      if (result[i] === "-metadata:g") {
        globalPairs.push(result[i + 1]);
      }
    }

    const timePair = globalPairs.find((p) => p.startsWith("creation_time="));
    expect(timePair).toBeDefined();
    const dateStr = timePair!.split("=")[1];
    // Should be ISO-8601 date with timezone offset (e.g. +09:00, -05:00, +5:30)
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{1,2}:\d{2}$/);
  });
});

describe("generateJumbledMetadataString", () => {
  it("returns a string", () => {
    const result = generateJumbledMetadataString();
    expect(typeof result).toBe("string");
  });

  it("includes -metadata flags for make, model, creation_time", () => {
    const result = generateJumbledMetadataString();

    expect(result).toContain("-metadata make=");
    expect(result).toContain("-metadata model=");
    expect(result).toContain("-metadata creation_time=");
  });

  it("includes stream handler metadata", () => {
    const result = generateJumbledMetadataString();

    expect(result).toContain("-metadata:s:v:0 handler_name=");
    expect(result).toContain("-metadata:s:a:0 handler_name=");
  });

  it("produces different results across calls (randomized)", () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(generateJumbledMetadataString());
    }
    // With 25 devices and random dates, should get variety
    expect(results.size).toBeGreaterThan(1);
  });
});
