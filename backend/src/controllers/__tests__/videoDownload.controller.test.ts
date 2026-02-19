import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse, createMockRequest } from "../../../test/helpers/express.helper";

const { mockGetVideoInfo, mockDownloadToS3, mockGetPresignedUrl } = vi.hoisted(() => ({
  mockGetVideoInfo: vi.fn(),
  mockDownloadToS3: vi.fn(),
  mockGetPresignedUrl: vi.fn(),
}));

vi.mock("../../services/videoDownload.service", () => ({
  videoDownloadService: {
    getVideoInfo: mockGetVideoInfo,
    downloadToS3: mockDownloadToS3,
  },
}));

vi.mock("../../services/s3.service", () => ({
  s3Service: {
    getPresignedUrl: mockGetPresignedUrl,
  },
}));

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

import { getVideoInfo, downloadVideo, downloadVideoSync } from "../videoDownload.controller";

describe("VideoDownload Controller", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getVideoInfo", () => {
    it("returns video info on success", async () => {
      const info = {
        title: "Test Video",
        duration: 120,
        filesize: 50000000,
        thumbnail: "https://thumb.jpg",
        uploader: "Channel",
        platform: "Youtube",
      };
      mockGetVideoInfo.mockResolvedValue(info);

      const req = createMockRequest({
        user: { id: "user1" } as any,
        body: { url: "https://youtube.com/watch?v=abc" },
      });
      const res = createMockResponse();

      await getVideoInfo(req, res);

      expect(res.json).toHaveBeenCalledWith(info);
      expect(mockGetVideoInfo).toHaveBeenCalledWith("https://youtube.com/watch?v=abc");
    });

    it("returns 401 if no user", async () => {
      const req = createMockRequest({ body: { url: "https://youtube.com/watch?v=abc" } });
      const res = createMockResponse();

      await getVideoInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns 400 if no URL", async () => {
      const req = createMockRequest({
        user: { id: "user1" } as any,
        body: {},
      });
      const res = createMockResponse();

      await getVideoInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 on service error", async () => {
      mockGetVideoInfo.mockRejectedValue(new Error("Unsupported URL"));

      const req = createMockRequest({
        user: { id: "user1" } as any,
        body: { url: "https://bad.url" },
      });
      const res = createMockResponse();

      await getVideoInfo(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unsupported URL" });
    });
  });

  describe("downloadVideoSync", () => {
    it("returns download result with downloadUrl on success", async () => {
      mockDownloadToS3.mockResolvedValue({
        s3Key: "raw-videos/1/video.mp4",
        fileName: "video.mp4",
        fileSize: 100000,
      });
      mockGetPresignedUrl.mockResolvedValue("https://s3.example.com/signed-url");

      const req = createMockRequest({
        user: { id: "user1" } as any,
        body: { url: "https://youtube.com/watch?v=abc", teamId: "1" },
      });
      const res = createMockResponse();

      await downloadVideoSync(req, res);

      expect(mockGetPresignedUrl).toHaveBeenCalledWith("raw-videos/1/video.mp4", 3600);
      expect(res.json).toHaveBeenCalledWith({
        s3Key: "raw-videos/1/video.mp4",
        fileName: "video.mp4",
        fileSize: 100000,
        downloadUrl: "https://s3.example.com/signed-url",
      });
    });

    it("returns 400 if missing url or teamId", async () => {
      const req = createMockRequest({
        user: { id: "user1" } as any,
        body: { url: "https://youtube.com/watch?v=abc" },
      });
      const res = createMockResponse();

      await downloadVideoSync(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 for invalid team ID", async () => {
      const req = createMockRequest({
        user: { id: "user1" } as any,
        body: { url: "https://youtube.com/watch?v=abc", teamId: "notanumber" },
      });
      const res = createMockResponse();

      await downloadVideoSync(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 500 on download failure", async () => {
      mockDownloadToS3.mockRejectedValue(new Error("Download timed out"));

      const req = createMockRequest({
        user: { id: "user1" } as any,
        body: { url: "https://youtube.com/watch?v=abc", teamId: "1" },
      });
      const res = createMockResponse();

      await downloadVideoSync(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("downloadVideo (SSE)", () => {
    it("sends SSE events including downloadUrl in complete event", async () => {
      mockDownloadToS3.mockImplementation(async (_url: string, _teamId: number, onProgress: any) => {
        onProgress({ percent: 50, speed: "5MB/s", eta: "00:10" });
        return { s3Key: "raw-videos/1/v.mp4", fileName: "v.mp4", fileSize: 100 };
      });
      mockGetPresignedUrl.mockResolvedValue("https://s3.example.com/signed-url");

      const writtenData: string[] = [];
      const req = createMockRequest({
        user: { id: "user1" } as any,
        body: { url: "https://youtube.com/watch?v=abc", teamId: "1" },
      });
      const res = {
        ...createMockResponse(),
        setHeader: vi.fn(),
        write: vi.fn((data: string) => writtenData.push(data)),
        end: vi.fn(),
        headersSent: false,
      } as any;

      await downloadVideo(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(writtenData.length).toBeGreaterThanOrEqual(3);
      expect(writtenData.some((d: string) => d.includes('"type":"start"'))).toBe(true);
      expect(writtenData.some((d: string) => d.includes('"type":"progress"'))).toBe(true);

      const completeEvent = writtenData.find((d: string) => d.includes('"type":"complete"'));
      expect(completeEvent).toBeDefined();
      const completeData = JSON.parse(completeEvent!.replace("data: ", "").trim());
      expect(completeData.downloadUrl).toBe("https://s3.example.com/signed-url");

      expect(mockGetPresignedUrl).toHaveBeenCalledWith("raw-videos/1/v.mp4", 3600);
      expect(res.end).toHaveBeenCalled();
    });

    it("sends error event on download failure", async () => {
      mockDownloadToS3.mockRejectedValue(new Error("Network error"));

      const writtenData: string[] = [];
      const req = createMockRequest({
        user: { id: "user1" } as any,
        body: { url: "https://youtube.com/watch?v=abc", teamId: "1" },
      });
      const res = {
        ...createMockResponse(),
        setHeader: vi.fn(),
        write: vi.fn((data: string) => writtenData.push(data)),
        end: vi.fn(),
        headersSent: false,
      } as any;

      await downloadVideo(req, res);

      expect(writtenData.some((d: string) => d.includes('"type":"error"'))).toBe(true);
      expect(res.end).toHaveBeenCalled();
    });
  });
});
