import { describe, it, expect } from "vitest";
import { mergeConsecutiveArollStructure } from "../ai-ugc/ugcScript.service";

describe("mergeConsecutiveArollStructure", () => {
  it("returns empty array for empty input", () => {
    expect(mergeConsecutiveArollStructure([])).toEqual([]);
  });

  it("leaves a single scene unchanged", () => {
    const input = [{ sceneType: "a-roll", slug: "Hook", description: "hook" }];
    expect(mergeConsecutiveArollStructure(input)).toEqual(input);
  });

  it("leaves non-consecutive a-rolls unchanged", () => {
    const input = [
      { sceneType: "a-roll", slug: "Hook", description: "hook" },
      { sceneType: "b-roll", slug: "Demo", description: "demo" },
      { sceneType: "a-roll", slug: "CTA", description: "cta" },
    ];
    expect(mergeConsecutiveArollStructure(input)).toEqual(input);
  });

  it("merges 2 consecutive a-rolls into one", () => {
    const input = [
      { sceneType: "a-roll", slug: "Hook", description: "hook" },
      { sceneType: "a-roll", slug: "Problem", description: "problem" },
      { sceneType: "b-roll", slug: "Demo", description: "demo" },
    ];
    const result = mergeConsecutiveArollStructure(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      sceneType: "a-roll",
      slug: "Hook + Problem",
      description: "hook", // lead scene wins
    });
    expect(result[1]).toEqual({
      sceneType: "b-roll",
      slug: "Demo",
      description: "demo",
    });
  });

  it("only merges up to 2 consecutive a-rolls (MAX_AROLL_MERGE_COUNT)", () => {
    const input = [
      { sceneType: "a-roll", slug: "Hook", description: "hook" },
      { sceneType: "a-roll", slug: "Problem", description: "problem" },
      { sceneType: "a-roll", slug: "Agitate", description: "agitate" },
      { sceneType: "b-roll", slug: "Demo", description: "demo" },
    ];
    const result = mergeConsecutiveArollStructure(input);
    // First 2 merge, third stays separate
    expect(result).toHaveLength(3);
    expect(result[0].slug).toBe("Hook + Problem");
    expect(result[1]).toEqual({
      sceneType: "a-roll",
      slug: "Agitate",
      description: "agitate",
    });
    expect(result[2].slug).toBe("Demo");
  });

  it("leaves b-roll only structures untouched", () => {
    const input = [
      { sceneType: "b-roll", slug: "Intro", description: "hook" },
      { sceneType: "b-roll", slug: "Demo", description: "demo" },
      { sceneType: "b-roll", slug: "Results", description: "transformation" },
    ];
    expect(mergeConsecutiveArollStructure(input)).toEqual(input);
  });

  it("handles multiple merge groups", () => {
    const input = [
      { sceneType: "a-roll", slug: "Hook", description: "hook" },
      { sceneType: "a-roll", slug: "Problem", description: "problem" },
      { sceneType: "b-roll", slug: "Demo", description: "demo" },
      { sceneType: "a-roll", slug: "Testimonial", description: "testimonial" },
      { sceneType: "a-roll", slug: "CTA", description: "cta" },
    ];
    const result = mergeConsecutiveArollStructure(input);
    expect(result).toHaveLength(3);
    expect(result[0].slug).toBe("Hook + Problem");
    expect(result[1].slug).toBe("Demo");
    expect(result[2].slug).toBe("Testimonial + CTA");
  });
});
