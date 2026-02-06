import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { AuthRequest } from "../../middleware/auth.middleware";
import type { Request } from "express";

const {
  mockClipManagerService,
  mockS3Service,
  mockSqsService,
  mockTeamService,
  mockTagService,
  mockUserService,
  mockGetTeamUsage,
} = vi.hoisted(() => ({
  mockClipManagerService: {
    getClipsByTeam: vi.fn(),
    getPendingClipsByTeam: vi.fn(),
    getCompletedClipsByTeam: vi.fn(),
    getClipById: vi.fn(),
    updateClip: vi.fn(),
    deleteClip: vi.fn(),
    saveClip: vi.fn(),
    rejectClip: vi.fn(),
    getUnsavedClipsByTeam: vi.fn(),
    getSavedUnorganizedClips: vi.fn(),
    getClipsByFolder: vi.fn(),
    getClipByShareToken: vi.fn(),
    generateShareToken: vi.fn(),
    removeShareToken: vi.fn(),
    updateClipStatus: vi.fn(),
    searchClips: vi.fn(),
    getTeamClipsCount: vi.fn(),
  },
  mockS3Service: {
    getMultiplePresignedUrls: vi.fn(),
    getPresignedUrl: vi.fn(),
    getPresignedDownloadUrl: vi.fn(),
    deleteObject: vi.fn(),
    getObject: vi.fn(),
  },
  mockSqsService: {
    sendUpdateCaptionsJob: vi.fn(),
    sendTextOverlayJob: vi.fn(),
    sendUpdateOverlaysJob: vi.fn(),
  },
  mockTeamService: {
    verifyTeamAccess: vi.fn(),
    getTeamById: vi.fn(),
    consumeClip: vi.fn(),
  },
  mockTagService: {
    getTagsForClip: vi.fn(),
    getTagsForClips: vi.fn(),
  },
  mockUserService: {
    getUserBySupabaseUid: vi.fn(),
  },
  mockGetTeamUsage: vi.fn(),
}));

vi.mock("../../services/clips/clipManager.service", () => ({ clipManagerService: mockClipManagerService }));
vi.mock("../../services/s3.service", () => ({ s3Service: mockS3Service }));
vi.mock("../../services/sqs.service", () => ({ sqsService: mockSqsService }));
vi.mock("../../services/team.service", () => ({ teamService: mockTeamService }));
vi.mock("../../services/tag.service", () => ({ tagService: mockTagService }));
vi.mock("../../services/user.service", () => ({ userService: mockUserService }));
vi.mock("../../middleware/subscription.middleware", () => ({ getTeamUsage: mockGetTeamUsage }));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

import { clipManagerController } from "../clipManager.controller";

function createReq(overrides: Record<string, any> = {}): AuthRequest {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as unknown as AuthRequest;
}

/** Set up mocks so verifyTeamAccessOrFail succeeds */
function allowAccess() {
  mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 42 });
  mockTeamService.verifyTeamAccess.mockResolvedValue(true);
}

describe("ClipManagerController.getClips", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "abc" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.getClips(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 when no user", async () => {
    const req = createReq({ params: { teamId: "1" } });
    const res = createMockResponse();
    await clipManagerController.getClips(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 when user lacks team access", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 42 });
    mockTeamService.verifyTeamAccess.mockResolvedValue(false);

    const req = createReq({ params: { teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.getClips(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns clips with presigned URLs", async () => {
    allowAccess();
    mockClipManagerService.getClipsByTeam.mockResolvedValue([
      { id: 1, clip_path: "clips/1.mp4", source_video_path: null },
    ]);
    mockS3Service.getMultiplePresignedUrls.mockResolvedValue({ "clips/1.mp4": "https://s3/signed" });

    const req = createReq({ params: { teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.getClips(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      clips: [expect.objectContaining({ clipUrl: "https://s3/signed" })],
    });
  });
});

describe("ClipManagerController.getClip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid IDs", async () => {
    const req = createReq({ params: { clipId: "abc", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.getClip(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 for unsaved clips", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: false });

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.getClip(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns clip with URLs on success", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({
      id: 1, saved: true, clip_path: "clips/1.mp4", source_video_path: null, blank_video_path: null,
    });
    mockS3Service.getPresignedUrl.mockResolvedValue("https://s3/clip");
    mockTagService.getTagsForClip.mockResolvedValue([]);

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.getClip(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      clip: expect.objectContaining({ clipUrl: "https://s3/clip", tags: [] }),
    });
  });
});

describe("ClipManagerController.deleteClip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes clip and S3 object", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, clip_path: "clips/1.mp4" });
    mockS3Service.deleteObject.mockResolvedValue(undefined);
    mockClipManagerService.deleteClip.mockResolvedValue(undefined);

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.deleteClip(req, res);
    expect(mockS3Service.deleteObject).toHaveBeenCalledWith("clips/1.mp4");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("ClipManagerController.saveClip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when clip already saved", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: true, status: "completed" });

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.saveClip(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when clip not completed", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: false, status: "pending" });

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.saveClip(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when clip limit reached", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: false, status: "completed" });
    mockGetTeamUsage.mockResolvedValue({ remaining: 0, clipsCreated: 400, baseLimit: 400 });

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.saveClip(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("saves clip and consumes credit on success", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({
      id: 1, saved: false, status: "completed", clip_path: "clips/1.mp4",
    });
    mockGetTeamUsage.mockResolvedValue({ remaining: 10, clipsCreated: 5, baseLimit: 400 });
    mockClipManagerService.saveClip.mockResolvedValue(undefined);
    mockTeamService.consumeClip.mockResolvedValue({ success: true });
    mockGetTeamUsage.mockResolvedValueOnce({ remaining: 10 }).mockResolvedValueOnce({ remaining: 9 });
    mockS3Service.getPresignedUrl.mockResolvedValue("https://s3/clip");

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.saveClip(req, res);
    expect(mockTeamService.consumeClip).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("ClipManagerController.updateClip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when moving to folder on free plan", async () => {
    allowAccess();
    mockTeamService.getTeamById.mockResolvedValue({ plan: "free" });

    const req = createReq({
      params: { clipId: "1", teamId: "1" },
      body: { folderId: 5 },
      user: { id: "u1" },
    });
    const res = createMockResponse();
    await clipManagerController.updateClip(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("updates clip successfully on scale plan", async () => {
    allowAccess();
    mockTeamService.getTeamById.mockResolvedValue({ plan: "scale" });
    mockClipManagerService.updateClip.mockResolvedValue({ id: 1, title: "New Title" });
    mockTagService.getTagsForClip.mockResolvedValue([]);

    const req = createReq({
      params: { clipId: "1", teamId: "1" },
      body: { title: "New Title", folderId: 5 },
      user: { id: "u1" },
    });
    const res = createMockResponse();
    await clipManagerController.updateClip(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("ClipManagerController.rejectClip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when clip is saved", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: true, status: "completed" });

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.rejectClip(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when already rejected", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: false, status: "rejected" });

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.rejectClip(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects clip successfully", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: false, status: "completed" });
    mockClipManagerService.rejectClip.mockResolvedValue(undefined);

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.rejectClip(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("ClipManagerController.getSharedClip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when shareToken missing", async () => {
    const req = { params: {} } as unknown as Request;
    const res = createMockResponse();
    await clipManagerController.getSharedClip(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns shared clip with URL", async () => {
    mockClipManagerService.getClipByShareToken.mockResolvedValue({
      id: 1, title: "Cool Clip", message: "Check this", clip_path: "clips/1.mp4", created_at: "2024-01-01",
    });
    mockS3Service.getPresignedUrl.mockResolvedValue("https://s3/clip");

    const req = { params: { shareToken: "abc123" } } as unknown as Request;
    const res = createMockResponse();
    await clipManagerController.getSharedClip(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      clip: expect.objectContaining({ title: "Cool Clip", clipUrl: "https://s3/clip" }),
    });
  });
});

describe("ClipManagerController.downloadSharedClip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns download URL", async () => {
    mockClipManagerService.getClipByShareToken.mockResolvedValue({
      id: 1, title: "My Clip", clip_path: "clips/1.mp4",
    });
    mockS3Service.getPresignedDownloadUrl.mockResolvedValue("https://s3/download");

    const req = { params: { shareToken: "abc123" } } as unknown as Request;
    const res = createMockResponse();
    await clipManagerController.downloadSharedClip(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ downloadUrl: "https://s3/download" });
  });

  it("returns 404 when clip has no file", async () => {
    mockClipManagerService.getClipByShareToken.mockResolvedValue({ id: 1, clip_path: null });

    const req = { params: { shareToken: "abc123" } } as unknown as Request;
    const res = createMockResponse();
    await clipManagerController.downloadSharedClip(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("ClipManagerController.generateShareLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for unsaved clip", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: false });

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.generateShareLink(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("generates share link on success", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: true });
    mockClipManagerService.generateShareToken.mockResolvedValue({ share_token: "token-xyz" });

    const req = createReq({ params: { clipId: "1", teamId: "1" }, user: { id: "u1" } });
    const res = createMockResponse();
    await clipManagerController.generateShareLink(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ shareToken: "token-xyz" }));
  });
});

describe("ClipManagerController.updateCaptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when captionsData invalid", async () => {
    allowAccess();

    const req = createReq({
      params: { clipId: "1", teamId: "1" },
      body: { captionsData: "not-array" },
      user: { id: "u1" },
    });
    const res = createMockResponse();
    await clipManagerController.updateCaptions(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 for unsaved clip", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: false, blank_video_path: "b.mp4" });

    const req = createReq({
      params: { clipId: "1", teamId: "1" },
      body: { captionsData: [{ index: 1, text: "hi" }] },
      user: { id: "u1" },
    });
    const res = createMockResponse();
    await clipManagerController.updateCaptions(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("queues captions update job", async () => {
    allowAccess();
    mockClipManagerService.getClipById.mockResolvedValue({ id: 1, saved: true, blank_video_path: "blank.mp4" });
    mockClipManagerService.updateClipStatus.mockResolvedValue(undefined);
    mockSqsService.sendUpdateCaptionsJob.mockResolvedValue("msg-cap");

    const req = createReq({
      params: { clipId: "1", teamId: "1" },
      body: { captionsData: [{ index: 1, text: "Hello" }] },
      user: { id: "u1", dbUserId: 10 },
    });
    const res = createMockResponse();
    await clipManagerController.updateCaptions(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ jobId: "msg-cap" }));
  });
});
