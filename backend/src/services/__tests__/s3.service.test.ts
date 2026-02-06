import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend, mockGetSignedUrl } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockGetSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3 {
    send = mockSend;
  },
  GetObjectCommand: class {
    input: any;
    constructor(input: any) { this.input = input; }
  },
  DeleteObjectCommand: class {
    input: any;
    constructor(input: any) { this.input = input; }
  },
  PutObjectCommand: class {
    input: any;
    constructor(input: any) { this.input = input; }
  },
  CreateMultipartUploadCommand: class {
    input: any;
    constructor(input: any) { this.input = input; }
  },
  UploadPartCommand: class {
    input: any;
    constructor(input: any) { this.input = input; }
  },
  CompleteMultipartUploadCommand: class {
    input: any;
    constructor(input: any) { this.input = input; }
  },
  AbortMultipartUploadCommand: class {
    input: any;
    constructor(input: any) { this.input = input; }
  },
}));

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class MockUpload {
    on() { return this; }
    done = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

vi.mock("../../config/env", () => ({
  config: { aws: { region: "us-east-1", s3Bucket: "test-bucket" } },
}));

vi.mock("../../utils/fileUtils", () => ({
  sanitizeFileName: (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_"),
}));

// Mock fs for upload methods that read files
vi.mock("fs", () => ({
  default: {
    statSync: vi.fn().mockReturnValue({ size: 1024 }),
    createReadStream: vi.fn().mockReturnValue("mock-stream"),
    createWriteStream: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    writeFileSync: vi.fn(),
  },
}));

import { s3Service } from "../s3.service";

describe("S3Service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getPresignedUrl", () => {
    it("returns a signed URL", async () => {
      mockGetSignedUrl.mockResolvedValue("https://s3.example.com/signed");
      const result = await s3Service.getPresignedUrl("clips/1.mp4");
      expect(result).toBe("https://s3.example.com/signed");
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    it("passes custom expiry", async () => {
      mockGetSignedUrl.mockResolvedValue("https://s3.example.com/signed");
      await s3Service.getPresignedUrl("clips/1.mp4", 7200);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 7200 },
      );
    });
  });

  describe("getPresignedDownloadUrl", () => {
    it("includes content disposition for download", async () => {
      mockGetSignedUrl.mockResolvedValue("https://s3.example.com/download");
      const result = await s3Service.getPresignedDownloadUrl("clips/1.mp4", "video.mp4");
      expect(result).toBe("https://s3.example.com/download");
    });
  });

  describe("deleteObject", () => {
    it("sends DeleteObjectCommand", async () => {
      mockSend.mockResolvedValue({});
      await s3Service.deleteObject("clips/1.mp4");
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Key).toBe("clips/1.mp4");
      expect(cmd.input.Bucket).toBe("test-bucket");
    });
  });

  describe("uploadBuffer", () => {
    it("sends PutObjectCommand with buffer", async () => {
      mockSend.mockResolvedValue({});
      const buf = Buffer.from("test");
      const result = await s3Service.uploadBuffer(buf, "uploads/test.txt", "text/plain");
      expect(result).toBe("uploads/test.txt");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("getObject", () => {
    it("sends GetObjectCommand", async () => {
      mockSend.mockResolvedValue({ Body: "stream", ContentType: "video/mp4" });
      const result = await s3Service.getObject("clips/1.mp4");
      expect(result.ContentType).toBe("video/mp4");
    });

    it("passes range header when provided", async () => {
      mockSend.mockResolvedValue({ Body: "stream" });
      await s3Service.getObject("clips/1.mp4", "bytes=0-1000");
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Range).toBe("bytes=0-1000");
    });
  });

  describe("getMultiplePresignedUrls", () => {
    it("returns URLs for all keys", async () => {
      mockGetSignedUrl
        .mockResolvedValueOnce("https://s3/url1")
        .mockResolvedValueOnce("https://s3/url2");

      const result = await s3Service.getMultiplePresignedUrls(["key1", "key2"]);
      expect(result).toEqual({ key1: "https://s3/url1", key2: "https://s3/url2" });
    });

    it("skips empty keys", async () => {
      mockGetSignedUrl.mockResolvedValue("https://s3/url");
      const result = await s3Service.getMultiplePresignedUrls(["key1", ""]);
      expect(Object.keys(result)).toEqual(["key1"]);
    });
  });

  describe("initiateMultipartUpload", () => {
    it("returns uploadId and s3Key", async () => {
      mockSend.mockResolvedValue({ UploadId: "upload-123" });
      const result = await s3Service.initiateMultipartUpload(1, "video.mp4", "video/mp4");
      expect(result.uploadId).toBe("upload-123");
      expect(result.s3Key).toContain("raw-videos/1/");
      expect(result.s3Key).toContain("video.mp4");
    });

    it("throws when UploadId missing", async () => {
      mockSend.mockResolvedValue({});
      await expect(
        s3Service.initiateMultipartUpload(1, "video.mp4", "video/mp4"),
      ).rejects.toThrow("Failed to initiate multipart upload");
    });
  });

  describe("getPresignedPartUrls", () => {
    it("returns signed URLs for each part", async () => {
      mockGetSignedUrl
        .mockResolvedValueOnce("https://s3/part1")
        .mockResolvedValueOnce("https://s3/part2");

      const result = await s3Service.getPresignedPartUrls("key", "upload-1", [1, 2]);
      expect(result).toEqual([
        { partNumber: 1, uploadUrl: "https://s3/part1" },
        { partNumber: 2, uploadUrl: "https://s3/part2" },
      ]);
    });
  });

  describe("completeMultipartUpload", () => {
    it("sends CompleteMultipartUploadCommand with sorted parts", async () => {
      mockSend.mockResolvedValue({});
      await s3Service.completeMultipartUpload("key", "upload-1", [
        { partNumber: 2, etag: "etag2" },
        { partNumber: 1, etag: "etag1" },
      ]);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.MultipartUpload.Parts[0].PartNumber).toBe(1);
      expect(cmd.input.MultipartUpload.Parts[1].PartNumber).toBe(2);
    });
  });

  describe("abortMultipartUpload", () => {
    it("sends AbortMultipartUploadCommand", async () => {
      mockSend.mockResolvedValue({});
      await s3Service.abortMultipartUpload("key", "upload-1");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("getPresignedUploadUrl", () => {
    it("returns upload URL and s3Key", async () => {
      mockGetSignedUrl.mockResolvedValue("https://s3/upload");
      const result = await s3Service.getPresignedUploadUrl(1, "video.mp4", "video/mp4");
      expect(result.uploadUrl).toBe("https://s3/upload");
      expect(result.s3Key).toContain("raw-videos/1/");
    });
  });

  describe("uploadCharacterImage", () => {
    it("uploads to correct key path", async () => {
      mockSend.mockResolvedValue({});
      const result = await s3Service.uploadCharacterImage(Buffer.from("img"), 1, "char-1", 0);
      expect(result).toBe("characters/1/char-1/generated/variant_0.png");
    });
  });

  describe("uploadTTSAudio", () => {
    it("uploads audio buffer to correct path", async () => {
      mockSend.mockResolvedValue({});
      const result = await s3Service.uploadTTSAudio(Buffer.from("audio"), 1, "script-1", 2);
      expect(result).toContain("ugc-audio/1/script-1/scene_2_");
    });
  });
});
