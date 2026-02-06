import { describe, it, expect, vi } from "vitest";
import path from "path";

const { mockFfmpeg } = vi.hoisted(() => {
  const mockFfmpeg: any = vi.fn();
  return { mockFfmpeg };
});

vi.mock("fluent-ffmpeg", () => {
  // Builder pattern: screenshots() returns an object with on()
  const eventHandlers: Record<string, Function> = {};
  const builder = {
    screenshots: vi.fn().mockReturnValue({
      on: vi.fn().mockImplementation((event: string, handler: Function) => {
        eventHandlers[event] = handler;
        // Auto-trigger "end" after registering both events
        if (event === "error" && eventHandlers["end"]) {
          Promise.resolve().then(() => eventHandlers["end"]());
        }
        return builder.screenshots();
      }),
    }),
  };

  mockFfmpeg.mockReturnValue(builder);
  mockFfmpeg.setFfmpegPath = vi.fn();

  return { default: mockFfmpeg };
});

vi.mock("ffmpeg-static", () => ({
  default: "/usr/bin/ffmpeg",
}));

import { extractThumbnail } from "../extractThumbnail";

describe("extractThumbnail", () => {
  it("resolves with correct output path", async () => {
    const result = await extractThumbnail("/tmp/video.mp4");

    // Output is in the same directory as input
    expect(result).toMatch(/^\/tmp\/thumbnail_\d+\.jpg$/);
  });

  it("calls ffmpeg with correct input path", async () => {
    await extractThumbnail("/videos/clip.mp4");

    expect(mockFfmpeg).toHaveBeenCalledWith("/videos/clip.mp4");
  });
});
