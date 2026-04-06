import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import { createDrizzleChain } from "../../../test/helpers/db.helper";
import type { Request } from "express";

const { mockDb, mockTeamService, mockS3Service, mockSqsService, mockCanAccessUGCStudio } =
  vi.hoisted(() => ({
    mockDb: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    mockTeamService: {
      getTeamById: vi.fn(),
      getTeamUsageStats: vi.fn(),
      consumeMultiple: vi.fn(),
    },
    mockS3Service: {
      getPresignedUrl: vi.fn(),
      getCharacterImagePresignedUpload: vi.fn(),
    },
    mockSqsService: {
      sendGenerateCharacterJob: vi.fn(),
    },
    mockCanAccessUGCStudio: vi.fn(),
  }));

vi.mock("../../db", () => ({ db: mockDb }));
vi.mock("../../services/team.service", () => ({ teamService: mockTeamService }));
vi.mock("../../services/s3.service", () => ({ s3Service: mockS3Service }));
vi.mock("../../services/sqs.service", () => ({ sqsService: mockSqsService }));
vi.mock("../../utils/plans", () => ({ canAccessUGCStudio: mockCanAccessUGCStudio }));
vi.mock("../../utils/controllerHelpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/controllerHelpers")>();
  return { ...actual, verifyTeamAccessOrFail: vi.fn().mockResolvedValue({ id: 1 }) };
});

import { actorController } from "../actor.controller";

function createReq(overrides: Record<string, any> = {}): Request {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as unknown as Request;
}

describe("ActorController.generatePreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when teamId or config missing", async () => {
    const req = createReq({ body: {} });
    const res = createMockResponse();
    await actorController.generatePreview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 when no user", async () => {
    const req = createReq({ body: { teamId: 1, config: {} } });
    const res = createMockResponse();
    await actorController.generatePreview(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 when no UGC access", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 1, plan: "free" });
    mockCanAccessUGCStudio.mockReturnValue(false);
    const req = createReq({
      body: { teamId: 1, config: { gender: "female" } },
      user: { dbUserId: 1 },
    });
    const res = createMockResponse();
    await actorController.generatePreview(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when insufficient credits", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 1, plan: "scale" });
    mockCanAccessUGCStudio.mockReturnValue(true);
    mockTeamService.getTeamUsageStats.mockResolvedValue({ limit: 10, clips_created: 10 });
    const req = createReq({
      body: { teamId: 1, config: { gender: "female" } },
      user: { dbUserId: 1 },
    });
    const res = createMockResponse();
    await actorController.generatePreview(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "INSUFFICIENT_CREDITS" }));
  });

  it("returns 202 on success", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 1, plan: "scale" });
    mockCanAccessUGCStudio.mockReturnValue(true);
    mockTeamService.getTeamUsageStats.mockResolvedValue({ limit: 10, clips_created: 5 });
    mockDb.insert.mockReturnValue(createDrizzleChain([{ id: "job-1" }]));
    mockSqsService.sendGenerateCharacterJob.mockResolvedValue(undefined);
    const req = createReq({
      body: { teamId: 1, config: { gender: "female", ageRange: "25-35", appearance: {}, style: {} } },
      user: { dbUserId: 1 },
    });
    const res = createMockResponse();
    await actorController.generatePreview(req, res);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ jobId: "job-1", status: "queued" }));
  });
});

describe("ActorController.getGenerationStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when jobId missing", async () => {
    const req = createReq({ params: {} });
    const res = createMockResponse();
    await actorController.getGenerationStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when job not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));
    const req = createReq({ params: { jobId: "bad" } });
    const res = createMockResponse();
    await actorController.getGenerationStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 200 with completed job including image URLs", async () => {
    mockDb.select.mockReturnValue(
      createDrizzleChain([{
        id: "job-1",
        status: "completed",
        progress: 100,
        progress_message: "Done",
        generated_images: ["key1", "key2"],
        generation_prompt: "a prompt",
        created_at: new Date(),
        started_at: new Date(),
        completed_at: new Date(),
      }])
    );
    mockS3Service.getPresignedUrl.mockResolvedValue("https://signed-url");
    const req = createReq({ params: { jobId: "job-1" } });
    const res = createMockResponse();
    await actorController.getGenerationStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as any).mock.calls[0][0];
    expect(body.images).toHaveLength(2);
    expect(body.prompt).toBe("a prompt");
  });
});

describe("ActorController.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when required fields missing", async () => {
    const req = createReq({ body: { teamId: 1, name: "Actor" } });
    const res = createMockResponse();
    await actorController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when insufficient credits", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 1, plan: "scale" });
    mockCanAccessUGCStudio.mockReturnValue(true);
    mockTeamService.consumeMultiple.mockResolvedValue({
      success: false,
      remaining: { base: 0, addon: 0, total: 0 },
    });
    const req = createReq({
      body: { teamId: 1, name: "Actor", selectedImageKeys: ["k1"] },
    });
    const res = createMockResponse();
    await actorController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 201 on success", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ id: 1, plan: "scale" });
    mockCanAccessUGCStudio.mockReturnValue(true);
    mockTeamService.consumeMultiple.mockResolvedValue({
      success: true,
      fromBase: 1,
      fromAddon: 0,
      remaining: { base: 5, addon: 0, total: 5 },
    });
    mockDb.insert.mockReturnValue(createDrizzleChain([{ id: 1, name: "Actor" }]));
    const req = createReq({
      body: { teamId: 1, name: "Actor", selectedImageKeys: ["k1"] },
    });
    const res = createMockResponse();
    await actorController.create(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("ActorController.getById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid id", async () => {
    const req = createReq({ params: { id: "abc" } });
    const res = createMockResponse();
    await actorController.getById(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));
    const req = createReq({ params: { id: "99" } });
    const res = createMockResponse();
    await actorController.getById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 200 with character and image URLs", async () => {
    mockDb.select.mockReturnValue(
      createDrizzleChain([{ id: 1, character_images: ["k1"], primary_image_index: 0 }])
    );
    mockS3Service.getPresignedUrl.mockResolvedValue("https://signed");
    const req = createReq({ params: { id: "1" } });
    const res = createMockResponse();
    await actorController.getById(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("ActorController.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when character not found", async () => {
    mockDb.update.mockReturnValue(createDrizzleChain([]));
    const req = createReq({ params: { id: "1" }, body: { name: "New" } });
    const res = createMockResponse();
    await actorController.update(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 200 on success", async () => {
    mockDb.update.mockReturnValue(createDrizzleChain([{ id: 1, name: "New" }]));
    const req = createReq({ params: { id: "1" }, body: { name: "New" } });
    const res = createMockResponse();
    await actorController.update(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("ActorController.delete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when not found", async () => {
    mockDb.delete.mockReturnValue(createDrizzleChain([]));
    const req = createReq({ params: { id: "1" } });
    const res = createMockResponse();
    await actorController.delete(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 200 on success", async () => {
    mockDb.delete.mockReturnValue(createDrizzleChain([{ id: 1 }]));
    const req = createReq({ params: { id: "1" } });
    const res = createMockResponse();
    await actorController.delete(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("ActorController.getPresignedUploadUrl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when teamId or fileName missing", async () => {
    const req = createReq({ body: {} });
    const res = createMockResponse();
    await actorController.getPresignedUploadUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with upload URL", async () => {
    mockS3Service.getCharacterImagePresignedUpload.mockResolvedValue({
      uploadUrl: "https://s3/upload",
      s3Key: "key/file.png",
    });
    const req = createReq({ body: { teamId: 1, fileName: "file.png" } });
    const res = createMockResponse();
    await actorController.getPresignedUploadUrl(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ uploadUrl: "https://s3/upload" }));
  });
});
