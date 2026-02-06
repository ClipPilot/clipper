import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { AuthRequest } from "../../middleware/auth.middleware";

const { mockYoutubeService } = vi.hoisted(() => ({
  mockYoutubeService: {
    getVideoInfo: vi.fn(),
    downloadAndUploadToS3: vi.fn(),
  },
}));

vi.mock("../../services/youtube.service", () => ({
  youtubeService: mockYoutubeService,
}));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

import { getVideoInfo, downloadVideoSync } from "../youtube.controller";

function createReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as AuthRequest;
}

describe("getVideoInfo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq();
    const res = createMockResponse();
    await getVideoInfo(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when url missing", async () => {
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, body: {} });
    const res = createMockResponse();
    await getVideoInfo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns video info on success", async () => {
    const info = { title: "Video", duration: 120 };
    mockYoutubeService.getVideoInfo.mockResolvedValue(info);
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      body: { url: "https://youtube.com/watch?v=abc" },
    });
    const res = createMockResponse();
    await getVideoInfo(req, res);
    expect(res.json).toHaveBeenCalledWith(info);
  });

  it("returns 400 when service throws", async () => {
    mockYoutubeService.getVideoInfo.mockRejectedValue(new Error("Invalid URL"));
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      body: { url: "bad-url" },
    });
    const res = createMockResponse();
    await getVideoInfo(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("downloadVideoSync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq();
    const res = createMockResponse();
    await downloadVideoSync(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when url or teamId missing", async () => {
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      body: { url: "https://yt.com" },
    });
    const res = createMockResponse();
    await downloadVideoSync(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for invalid team ID", async () => {
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      body: { url: "https://yt.com", teamId: "abc" },
    });
    const res = createMockResponse();
    await downloadVideoSync(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns result on success", async () => {
    const result = { s3Key: "key/video.mp4", fileName: "video.mp4", fileSize: 1024 };
    mockYoutubeService.downloadAndUploadToS3.mockResolvedValue(result);
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      body: { url: "https://yt.com/watch?v=abc", teamId: "5" },
    });
    const res = createMockResponse();
    await downloadVideoSync(req, res);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it("returns 500 on download error", async () => {
    mockYoutubeService.downloadAndUploadToS3.mockRejectedValue(new Error("Download failed"));
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      body: { url: "https://yt.com/watch?v=abc", teamId: "5" },
    });
    const res = createMockResponse();
    await downloadVideoSync(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
