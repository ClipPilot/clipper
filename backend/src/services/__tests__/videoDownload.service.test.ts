import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
}));

const { mockUploadRawVideo, mockDownloadVideoFromUrl } = vi.hoisted(() => ({
  mockUploadRawVideo: vi.fn(),
  mockDownloadVideoFromUrl: vi.fn(),
}));

const { mockExistsSync, mockMkdirSync, mockStatSync, mockUnlinkSync, mockReaddirSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockReaddirSync: vi.fn(),
}));

const { mockDownloadYouTubeVideo, mockScrapeInstagramReel } = vi.hoisted(() => ({
  mockDownloadYouTubeVideo: vi.fn(),
  mockScrapeInstagramReel: vi.fn(),
}));

vi.mock("child_process", () => ({
  spawn: mockSpawn,
}));

vi.mock("../s3.service", () => ({
  s3Service: {
    uploadRawVideo: mockUploadRawVideo,
    downloadVideoFromUrl: mockDownloadVideoFromUrl,
  },
}));

vi.mock("fs", () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    statSync: mockStatSync,
    unlinkSync: mockUnlinkSync,
    readdirSync: mockReaddirSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  statSync: mockStatSync,
  unlinkSync: mockUnlinkSync,
  readdirSync: mockReaddirSync,
}));

vi.mock("../virality/apify.service", () => ({
  getApifyService: () => ({
    downloadYouTubeVideo: mockDownloadYouTubeVideo,
    scrapeInstagramReel: mockScrapeInstagramReel,
  }),
}));

import { videoDownloadService } from "../videoDownload.service";

function createMockProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  return proc;
}

describe("VideoDownloadService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getVideoInfo", () => {
    it("uses oEmbed for YouTube metadata", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          title: "Test Video",
          author_name: "Test Channel",
          thumbnail_url: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
        }),
      } as Response);

      const info = await videoDownloadService.getVideoInfo("https://youtube.com/watch?v=abc");
      expect(info).toEqual({
        title: "Test Video",
        duration: 0,
        filesize: 0,
        thumbnail: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
        uploader: "Test Channel",
        platform: "YouTube",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("youtube.com/oembed"),
      );
      expect(mockSpawn).not.toHaveBeenCalled();
      mockFetch.mockRestore();
    });

    it("uses yt-dlp for non-YouTube URLs (Twitch, Kick, etc.)", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = videoDownloadService.getVideoInfo("https://twitch.tv/videos/123");

      proc.stdout.emit("data", Buffer.from(JSON.stringify({
        title: "Twitch Stream",
        duration: 3600,
        filesize_approx: 100000000,
        thumbnail: "https://thumb.twitch.tv/img.jpg",
        uploader: "StreamerName",
        extractor_key: "TwitchVod",
      })));
      proc.emit("close", 0);

      const info = await promise;
      expect(info).toEqual({
        title: "Twitch Stream",
        duration: 3600,
        filesize: 100000000,
        thumbnail: "https://thumb.twitch.tv/img.jpg",
        uploader: "StreamerName",
        platform: "TwitchVod",
      });

      expect(mockSpawn).toHaveBeenCalledWith("yt-dlp", [
        "--js-runtimes",
        "node",
        "--dump-json",
        "--no-download",
        "https://twitch.tv/videos/123",
      ]);
    });

    it("rejects on non-zero exit code", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = videoDownloadService.getVideoInfo("https://bad.url");

      proc.stderr.emit("data", Buffer.from("ERROR: Unsupported URL"));
      proc.emit("close", 1);

      await expect(promise).rejects.toThrow("ERROR: Unsupported URL");
    });

    it("rejects on spawn error", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = videoDownloadService.getVideoInfo("https://twitch.tv/videos/123");

      proc.emit("error", new Error("yt-dlp not found"));

      await expect(promise).rejects.toThrow("Failed to spawn yt-dlp: yt-dlp not found");
    });

    it("handles missing optional fields gracefully", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = videoDownloadService.getVideoInfo("https://example.com/video");

      proc.stdout.emit("data", Buffer.from(JSON.stringify({
        title: "Minimal",
      })));
      proc.emit("close", 0);

      const info = await promise;
      expect(info.title).toBe("Minimal");
      expect(info.duration).toBe(0);
      expect(info.platform).toBe("Unknown");
    });
  });

  describe("downloadToS3", () => {
    it("uses Apify for YouTube downloads", async () => {
      mockDownloadYouTubeVideo.mockResolvedValue({
        downloadUrl: "https://apify.com/video.mp4",
        title: "YT Video",
        duration: 120,
        thumbnail: "",
        uploader: "",
        fileSize: 50000,
      });
      mockExistsSync.mockReturnValue(true);
      mockDownloadVideoFromUrl.mockResolvedValue(undefined);
      mockStatSync.mockReturnValue({ size: 50000 });
      mockUploadRawVideo.mockResolvedValue("raw-videos/1/video.mp4");

      const result = await videoDownloadService.downloadToS3(
        "https://youtube.com/watch?v=abc",
        1
      );

      expect(result.s3Key).toBe("raw-videos/1/video.mp4");
      expect(mockDownloadYouTubeVideo).toHaveBeenCalledWith("https://youtube.com/watch?v=abc");
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("uses yt-dlp for Twitch/Kick downloads", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ size: 100000, mtimeMs: Date.now() });
      mockUploadRawVideo.mockResolvedValue("raw-videos/1/video.mp4");

      const onProgress = vi.fn();

      const promise = videoDownloadService.downloadToS3(
        "https://twitch.tv/videos/123",
        1,
        onProgress
      );

      proc.stdout.emit(
        "data",
        Buffer.from("download: 50.0%  5.2MiB/s  00:10\n")
      );

      proc.stdout.emit(
        "data",
        Buffer.from('[Merger] Merging formats into "/app/backend/output/1_123_Test Video.mp4"\n')
      );

      proc.emit("close", 0);

      const result = await promise;

      expect(result.s3Key).toBe("raw-videos/1/video.mp4");
      expect(result.fileSize).toBe(100000);
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ percent: 50, speed: "5.2MiB/s" })
      );
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it("cleans up temp file even on S3 upload failure", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ size: 100000, mtimeMs: Date.now() });
      mockUploadRawVideo.mockRejectedValue(new Error("S3 upload failed"));

      const promise = videoDownloadService.downloadToS3(
        "https://twitch.tv/videos/123",
        1
      );

      proc.stdout.emit(
        "data",
        Buffer.from('[download] Destination: /app/backend/output/1_123_Test.mp4\n')
      );
      proc.emit("close", 0);

      await expect(promise).rejects.toThrow("S3 upload failed");
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it("rejects when yt-dlp fails", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);
      mockExistsSync.mockReturnValue(true);

      const promise = videoDownloadService.downloadToS3(
        "https://kick.com/video/bad",
        1
      );

      proc.stderr.emit("data", Buffer.from("ERROR: Video unavailable"));
      proc.emit("close", 1);

      await expect(promise).rejects.toThrow("ERROR: Video unavailable");
    });

    it("falls back to scanning output dir when no merge line detected", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);
      mockExistsSync
        .mockReturnValueOnce(true)  // OUTPUT_DIR check
        .mockReturnValueOnce(false) // lastFilePath check (no path captured)
        .mockReturnValueOnce(true); // cleanup check
      mockReaddirSync.mockReturnValue(["1_999_fallback.mp4"]);
      mockStatSync.mockReturnValue({ size: 50000, mtimeMs: Date.now() });
      mockUploadRawVideo.mockResolvedValue("raw-videos/1/fallback.mp4");

      const promise = videoDownloadService.downloadToS3(
        "https://example.com/video",
        1
      );

      proc.emit("close", 0);

      const result = await promise;
      expect(result.s3Key).toBe("raw-videos/1/fallback.mp4");
    });
  });
});
