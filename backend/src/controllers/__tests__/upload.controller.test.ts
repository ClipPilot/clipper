import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { AuthRequest } from "../../middleware/auth.middleware";

const { mockS3Service, mockSqsService, mockTeamService, mockClipManagerService } = vi.hoisted(() => ({
  mockS3Service: {
    initiateMultipartUpload: vi.fn(),
    getPresignedPartUrls: vi.fn(),
    completeMultipartUpload: vi.fn(),
    abortMultipartUpload: vi.fn(),
    getPresignedUploadUrl: vi.fn(),
  },
  mockSqsService: {
    sendClipVideoJob: vi.fn(),
    sendBatchClipVideoJob: vi.fn(),
  },
  mockTeamService: {
    getTeamById: vi.fn(),
    getTeamUsageStats: vi.fn(),
  },
  mockClipManagerService: {
    getTeamClipsCount: vi.fn(),
    createRawVideo: vi.fn(),
    createPendingClip: vi.fn(),
  },
}));

vi.mock("../../services/s3.service", () => ({ s3Service: mockS3Service }));
vi.mock("../../services/sqs.service", () => ({ sqsService: mockSqsService }));
vi.mock("../../services/team.service", () => ({ teamService: mockTeamService }));
vi.mock("../../services/clips/clipManager.service", () => ({ clipManagerService: mockClipManagerService }));
vi.mock("../../config/stripe.config", () => ({
  PLAN_LIMITS: {
    FREE: { generations: 3, maxUploadSizeGB: 2 },
    STUDIO: { maxUploadSizeGB: 2 },
    SCALE: { maxUploadSizeGB: 3 },
    ENTERPRISE: { maxUploadSizeGB: 3 },
  },
  stripe: {},
  STRIPE_PRICES: {},
  getPlanFromPriceId: vi.fn(),
  getClipsLimitForPlan: vi.fn(),
  isAddonPrice: vi.fn(),
  getAddonClips: vi.fn(),
  getMaxUploadSizeForPlan: (plan: string) => {
    const limits: Record<string, number> = {
      scale: 3 * 1024 * 1024 * 1024,
      enterprise: 3 * 1024 * 1024 * 1024,
      studio: 2 * 1024 * 1024 * 1024,
    };
    return limits[plan] ?? 2 * 1024 * 1024 * 1024;
  },
}));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

import {
  initiateMultipartUpload,
  completeMultipartUpload,
  abortMultipartUpload,
  getPresignedUploadUrl,
  submitClipJob,
  submitBatchClipJob,
} from "../upload.controller";

function createReq(overrides: Record<string, any> = {}): AuthRequest {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as unknown as AuthRequest;
}

describe("initiateMultipartUpload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ body: {} });
    const res = createMockResponse();
    await initiateMultipartUpload(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when required fields missing", async () => {
    const req = createReq({ user: { id: "u1" }, body: { teamId: "1" } });
    const res = createMockResponse();
    await initiateMultipartUpload(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when file too large", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "free" });
    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1", fileName: "video.mp4", contentType: "video/mp4", fileSize: 3 * 1024 * 1024 * 1024 },
    });
    const res = createMockResponse();
    await initiateMultipartUpload(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("2GB") }));
  });

  it("allows 3GB upload for scale plan", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "scale" });
    mockS3Service.initiateMultipartUpload.mockResolvedValue({ uploadId: "up-1", s3Key: "raw/1/v.mp4" });
    mockS3Service.getPresignedPartUrls.mockResolvedValue({ 1: "https://s3/part1" });

    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1", fileName: "video.mp4", contentType: "video/mp4", fileSize: 2.5 * 1024 * 1024 * 1024 },
    });
    const res = createMockResponse();
    await initiateMultipartUpload(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ uploadId: "up-1", s3Key: "raw/1/v.mp4" }));
  });

  it("returns 400 for invalid content type", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "free" });
    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1", fileName: "doc.pdf", contentType: "application/pdf", fileSize: 1000 },
    });
    const res = createMockResponse();
    await initiateMultipartUpload(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns upload details on success", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "studio" });
    mockS3Service.initiateMultipartUpload.mockResolvedValue({ uploadId: "up-1", s3Key: "raw/1/v.mp4" });
    mockS3Service.getPresignedPartUrls.mockResolvedValue({ 1: "https://s3/part1" });

    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1", fileName: "video.mp4", contentType: "video/mp4", fileSize: 5 * 1024 * 1024 },
    });
    const res = createMockResponse();
    await initiateMultipartUpload(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ uploadId: "up-1", s3Key: "raw/1/v.mp4" }));
  });
});

describe("completeMultipartUpload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ body: {} });
    const res = createMockResponse();
    await completeMultipartUpload(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when fields missing", async () => {
    const req = createReq({ user: { id: "u1" }, body: { s3Key: "k" } });
    const res = createMockResponse();
    await completeMultipartUpload(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("completes upload successfully", async () => {
    mockS3Service.completeMultipartUpload.mockResolvedValue(undefined);
    const req = createReq({
      user: { id: "u1" },
      body: { s3Key: "raw/1/v.mp4", uploadId: "up-1", parts: [{ PartNumber: 1, ETag: "etag" }] },
    });
    const res = createMockResponse();
    await completeMultipartUpload(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, s3Key: "raw/1/v.mp4" });
  });
});

describe("abortMultipartUpload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ body: {} });
    const res = createMockResponse();
    await abortMultipartUpload(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("aborts upload successfully", async () => {
    mockS3Service.abortMultipartUpload.mockResolvedValue(undefined);
    const req = createReq({
      user: { id: "u1" },
      body: { s3Key: "raw/1/v.mp4", uploadId: "up-1" },
    });
    const res = createMockResponse();
    await abortMultipartUpload(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

describe("getPresignedUploadUrl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid content type", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "free" });
    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1", fileName: "f.txt", contentType: "text/plain" },
    });
    const res = createMockResponse();
    await getPresignedUploadUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns presigned URL on success", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "studio" });
    mockS3Service.getPresignedUploadUrl.mockResolvedValue({ uploadUrl: "https://s3/upload", s3Key: "raw/1/v.mp4" });
    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1", fileName: "video.mp4", contentType: "video/mp4" },
    });
    const res = createMockResponse();
    await getPresignedUploadUrl(req, res);
    expect(res.json).toHaveBeenCalledWith({ uploadUrl: "https://s3/upload", s3Key: "raw/1/v.mp4" });
  });
});

describe("submitClipJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ body: {} });
    const res = createMockResponse();
    await submitClipJob(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 for invalid body (missing s3Key)", async () => {
    const req = createReq({ user: { id: "u1", dbUserId: 10 }, body: { teamId: "1" } });
    const res = createMockResponse();
    await submitClipJob(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when free plan generation limit reached", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "free" });
    mockTeamService.getTeamUsageStats.mockResolvedValue({ limit: 15 });
    mockClipManagerService.getTeamClipsCount.mockResolvedValue(3);

    const req = createReq({
      user: { id: "u1", dbUserId: 10 },
      body: { teamId: "1", s3Key: "raw-videos/1/file.mp4" },
    });
    const res = createMockResponse();
    await submitClipJob(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("submits job successfully for paid plan", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "studio" });
    mockClipManagerService.createRawVideo.mockResolvedValue({ id: 1 });
    mockClipManagerService.createPendingClip.mockResolvedValue({ id: 100 });
    mockSqsService.sendClipVideoJob.mockResolvedValue("msg-123");

    const req = createReq({
      user: { id: "u1", dbUserId: 10 },
      body: { teamId: "1", s3Key: "raw-videos/1/file.mp4" },
    });
    const res = createMockResponse();
    await submitClipJob(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ clipIds: [100], status: "queued" }));
  });

  it("returns 400 for invalid promptType", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "studio" });

    const req = createReq({
      user: { id: "u1", dbUserId: 10 },
      body: { teamId: "1", s3Key: "raw-videos/1/file.mp4", promptType: "invalid_type" },
    });
    const res = createMockResponse();
    await submitClipJob(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("submitBatchClipJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ body: {} });
    const res = createMockResponse();
    await submitBatchClipJob(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when videos missing", async () => {
    const req = createReq({ user: { id: "u1" }, body: { teamId: "1" } });
    const res = createMockResponse();
    await submitBatchClipJob(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when videos not an array", async () => {
    const req = createReq({ user: { id: "u1" }, body: { teamId: "1", videos: "not-array" } });
    const res = createMockResponse();
    await submitBatchClipJob(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when exceeding max batch videos", async () => {
    const videos = Array.from({ length: 6 }, (_, i) => ({ s3Key: `k${i}`, videoIndex: i, duration: 60 }));
    const req = createReq({ user: { id: "u1" }, body: { teamId: "1", videos } });
    const res = createMockResponse();
    await submitBatchClipJob(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("5") }));
  });

  it("returns 400 when video missing s3Key", async () => {
    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1", videos: [{ videoIndex: 0, duration: 60 }] },
    });
    const res = createMockResponse();
    await submitBatchClipJob(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when video exceeds max duration", async () => {
    const req = createReq({
      user: { id: "u1" },
      body: {
        teamId: "1",
        videos: [{ s3Key: "k1", videoIndex: 0, duration: 31 * 60, originalFileName: "long.mp4" }],
      },
    });
    const res = createMockResponse();
    await submitBatchClipJob(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("30 minutes") }));
  });

  it("submits batch job successfully", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "studio" });
    mockClipManagerService.createRawVideo.mockResolvedValue({ id: 1 });
    mockClipManagerService.createPendingClip.mockResolvedValue({ id: 200 });
    mockSqsService.sendBatchClipVideoJob.mockResolvedValue("msg-batch");

    const req = createReq({
      user: { id: "u1", dbUserId: 10 },
      body: {
        teamId: "1",
        videos: [
          { s3Key: "raw/1/a.mp4", videoIndex: 0, duration: 120 },
          { s3Key: "raw/1/b.mp4", videoIndex: 1, duration: 90 },
        ],
      },
    });
    const res = createMockResponse();
    await submitBatchClipJob(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ clipIds: [200], status: "queued" }));
  });
});
