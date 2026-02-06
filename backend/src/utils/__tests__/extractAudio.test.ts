import { describe, it, expect, vi } from "vitest";

const { mockFfmpeg } = vi.hoisted(() => {
  const mockFfmpeg: any = vi.fn();
  return { mockFfmpeg };
});

vi.mock("fluent-ffmpeg", () => {
  const eventHandlers: Record<string, Function> = {};
  const builder: any = {};
  builder.noVideo = vi.fn().mockReturnValue(builder);
  builder.audioChannels = vi.fn().mockReturnValue(builder);
  builder.audioFrequency = vi.fn().mockReturnValue(builder);
  builder.audioCodec = vi.fn().mockReturnValue(builder);
  builder.format = vi.fn().mockReturnValue(builder);
  builder.save = vi.fn().mockImplementation(() => {
    // Auto-trigger "end" after save is called
    Promise.resolve().then(() => {
      if (eventHandlers["end"]) eventHandlers["end"]();
    });
    return builder;
  });
  builder.on = vi.fn().mockImplementation((event: string, handler: Function) => {
    eventHandlers[event] = handler;
    return builder;
  });

  mockFfmpeg.mockReturnValue(builder);
  mockFfmpeg.setFfmpegPath = vi.fn();
  mockFfmpeg._builder = builder;

  return { default: mockFfmpeg };
});

vi.mock("ffmpeg-static", () => ({
  default: "/usr/bin/ffmpeg",
}));

import { extractAudio } from "../extractAudio";

describe("extractAudio", () => {
  it("resolves with .wav output path", async () => {
    const result = await extractAudio("/tmp/video.mp4");
    expect(result).toBe("/tmp/video.wav");
  });

  it("handles various extensions", async () => {
    const result = await extractAudio("/clips/file.mov");
    expect(result).toBe("/clips/file.wav");
  });

  it("calls ffmpeg with correct audio settings", async () => {
    await extractAudio("/tmp/video.mp4");

    expect(mockFfmpeg).toHaveBeenCalledWith("/tmp/video.mp4");

    const builder = mockFfmpeg._builder;
    expect(builder.noVideo).toHaveBeenCalled();
    expect(builder.audioChannels).toHaveBeenCalledWith(1);
    expect(builder.audioFrequency).toHaveBeenCalledWith(16000);
    expect(builder.audioCodec).toHaveBeenCalledWith("pcm_s16le");
    expect(builder.format).toHaveBeenCalledWith("wav");
    expect(builder.save).toHaveBeenCalledWith("/tmp/video.wav");
  });
});
