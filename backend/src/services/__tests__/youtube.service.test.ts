import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// YouTubeService reads env vars in the constructor, so we
// instantiate a fresh instance per test group via dynamic import.

const originalFetch = globalThis.fetch;

describe("YouTubeService", () => {
  let youtubeService: any;

  beforeEach(async () => {
    vi.resetModules();
    process.env.YOUTUBE_LAMBDA_URL = "https://lambda.test/yt";
    const mod = await import("../youtube.service");
    youtubeService = mod.youtubeService;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("getVideoInfo", () => {
    it("throws for invalid YouTube URL", async () => {
      await expect(
        youtubeService.getVideoInfo("https://vimeo.com/12345")
      ).rejects.toThrow("Invalid YouTube URL");
    });

    it("throws for empty URL", async () => {
      await expect(youtubeService.getVideoInfo("")).rejects.toThrow(
        "Invalid YouTube URL"
      );
    });

    it("accepts standard youtube.com/watch URL", async () => {
      const videoInfo = { title: "Test", duration: 60, filesize: 1000, thumbnail: "", uploader: "me" };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(videoInfo),
      });

      const result = await youtubeService.getVideoInfo(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      );

      expect(result).toEqual(videoInfo);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://lambda.test/yt",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("dQw4w9WgXcQ"),
        })
      );
    });

    it("accepts youtu.be short URL", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: "Short" }),
      });

      await youtubeService.getVideoInfo("https://youtu.be/abc123xyz");

      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it("accepts YouTube Shorts URL", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: "Short" }),
      });

      await youtubeService.getVideoInfo(
        "https://www.youtube.com/shorts/abc123xyz"
      );

      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it("accepts YouTube embed URL", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: "Embed" }),
      });

      await youtubeService.getVideoInfo(
        "https://www.youtube.com/embed/abc123xyz"
      );

      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it("throws when Lambda returns error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      });

      await expect(
        youtubeService.getVideoInfo("https://youtube.com/watch?v=abc123")
      ).rejects.toThrow("Error getting video info.");
    });
  });

  describe("downloadAndUploadToS3", () => {
    it("throws for invalid YouTube URL", async () => {
      await expect(
        youtubeService.downloadAndUploadToS3("https://notytube.com", 1)
      ).rejects.toThrow("Invalid YouTube URL");
    });

    it("returns s3Key, fileName, fileSize on success", async () => {
      const lambdaResult = {
        s3Key: "teams/1/uploads/video.mp4",
        fileName: "video.mp4",
        fileSize: 5000000,
        bucket: "my-bucket",
      };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(lambdaResult),
      });

      const result = await youtubeService.downloadAndUploadToS3(
        "https://youtube.com/watch?v=abc123",
        1
      );

      expect(result).toEqual({
        s3Key: "teams/1/uploads/video.mp4",
        fileName: "video.mp4",
        fileSize: 5000000,
      });
    });

    it("calls onProgress at start and end", async () => {
      const lambdaResult = {
        s3Key: "key",
        fileName: "f.mp4",
        fileSize: 1000,
        bucket: "b",
      };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(lambdaResult),
      });

      const onProgress = vi.fn();
      await youtubeService.downloadAndUploadToS3(
        "https://youtube.com/watch?v=abc123",
        1,
        onProgress
      );

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({ percent: 0 }));
      expect(onProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({ percent: 100 }));
    });

    it("sends teamId and environment in request body", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ s3Key: "k", fileName: "f", fileSize: 1, bucket: "b" }),
      });

      await youtubeService.downloadAndUploadToS3(
        "https://youtube.com/watch?v=abc123",
        42
      );

      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.teamId).toBe(42);
      expect(body.action).toBe("download");
      expect(body.environment).toBeDefined();
    });
  });
});
