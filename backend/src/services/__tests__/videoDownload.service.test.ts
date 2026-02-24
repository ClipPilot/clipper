import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
}));

const { mockUploadRawVideo } = vi.hoisted(() => ({
  mockUploadRawVideo: vi.fn(),
}));

const { mockExistsSync, mockMkdirSync, mockStatSync, mockUnlinkSync, mockReaddirSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockReaddirSync: vi.fn(),
}));

vi.mock("child_process", () => ({
  spawn: mockSpawn,
}));

vi.mock("../s3.service", () => ({
  s3Service: {
    uploadRawVideo: mockUploadRawVideo,
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
    it("parses yt-dlp JSON output correctly", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = videoDownloadService.getVideoInfo("https://youtube.com/watch?v=abc");

      const ytdlpOutput = JSON.stringify({
        title: "Test Video",
        duration: 120,
        filesize_approx: 50000000,
        thumbnail: "https://img.youtube.com/thumb.jpg",
        uploader: "Test Channel",
        extractor_key: "Youtube",
      });

      proc.stdout.emit("data", Buffer.from(ytdlpOutput));
      proc.emit("close", 0);

      const info = await promise;
      expect(info).toEqual({
        title: "Test Video",
        duration: 120,
        filesize: 50000000,
        thumbnail: "https://img.youtube.com/thumb.jpg",
        uploader: "Test Channel",
        platform: "Youtube",
      });

      expect(mockSpawn).toHaveBeenCalledWith("yt-dlp", [
        "--js-runtimes",
        "nodejs",
        "--max-filesize",
        "2G",
        "--dump-json",
        "--no-download",
        "https://youtube.com/watch?v=abc",
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

      const promise = videoDownloadService.getVideoInfo("https://youtube.com/watch?v=abc");

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
    it("downloads, uploads to S3, and cleans up temp file", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ size: 100000, mtimeMs: Date.now() });
      mockUploadRawVideo.mockResolvedValue("raw-videos/1/video.mp4");

      const onProgress = vi.fn();

      const promise = videoDownloadService.downloadToS3(
        "https://youtube.com/watch?v=abc",
        1,
        onProgress
      );

      // Emit progress
      proc.stdout.emit(
        "data",
        Buffer.from("download: 50.0%  5.2MiB/s  00:10\n")
      );

      // Emit merge destination
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
      // Temp file cleanup
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it("cleans up temp file even on S3 upload failure", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ size: 100000, mtimeMs: Date.now() });
      mockUploadRawVideo.mockRejectedValue(new Error("S3 upload failed"));

      const promise = videoDownloadService.downloadToS3(
        "https://youtube.com/watch?v=abc",
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
        "https://youtube.com/watch?v=bad",
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
