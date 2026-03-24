import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockResponse } from "../../../test/helpers/express.helper";

const { mockUgcScriptService } = vi.hoisted(() => ({
  mockUgcScriptService: {
    initStructure: vi.fn(),
  },
}));

vi.mock("../../services/ai-ugc/ugcScript.service", () => ({
  ugcScriptService: mockUgcScriptService,
}));

vi.mock("../../services/s3.service", () => ({
  s3Service: { getProductImagePresignedUpload: vi.fn() },
}));
vi.mock("../../services/sqs.service", () => ({
  sqsService: { sendGenerateScriptJob: vi.fn() },
}));
vi.mock("../../services/team.service", () => ({
  teamService: { getTeamById: vi.fn() },
}));
vi.mock("../../utils/plans", () => ({
  canAccessUGCStudio: vi.fn().mockReturnValue(true),
}));
vi.mock("../../db", () => ({
  db: new Proxy(
    {},
    {
      get: () =>
        vi.fn(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          leftJoin: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockReturnThis(),
          then: (resolve: Function) => resolve([]),
        })),
    },
  ),
}));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

import { UGCScriptController } from "../ugcScript.controller";

describe("UGCScriptController.initStructure", () => {
  let controller: UGCScriptController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UGCScriptController();
  });

  it("returns 400 when message is missing", async () => {
    const req = createMockRequest({ body: {} });
    const res = createMockResponse();

    await controller.initStructure(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "message is required" });
  });

  it("returns 400 when message is empty string", async () => {
    const req = createMockRequest({ body: { message: "   " } });
    const res = createMockResponse();

    await controller.initStructure(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "message is required" });
  });

  it("returns 400 when more than 5 product images", async () => {
    const req = createMockRequest({
      body: {
        message: "Make me a video",
        productImageKeys: ["a", "b", "c", "d", "e", "f"],
      },
    });
    const res = createMockResponse();

    await controller.initStructure(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Maximum 5 product images allowed",
    });
  });

  it("returns 200 with agent result on success", async () => {
    const agentResult = {
      videoType: "ugc",
      isSilent: false,
      character: true,
      structure: [
        { sceneType: "a-roll", slug: "Attention Hook", description: "hook" },
        { sceneType: "b-roll", slug: "Product Demo", description: "demo" },
        { sceneType: "a-roll", slug: "Call to Action", description: "cta" },
      ],
    };
    mockUgcScriptService.initStructure.mockResolvedValue(agentResult);

    const req = createMockRequest({
      body: { message: "Make a skincare product video" },
    });
    const res = createMockResponse();

    await controller.initStructure(req, res);

    expect(mockUgcScriptService.initStructure).toHaveBeenCalledWith({
      message: "Make a skincare product video",
      productImageKeys: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      ...agentResult,
    });
  });

  it("passes productImageKeys to service when provided", async () => {
    mockUgcScriptService.initStructure.mockResolvedValue({
      videoType: "ugc",
      isSilent: false,
      character: true,
      structure: [],
    });

    const req = createMockRequest({
      body: {
        message: "Analyze these images",
        productImageKeys: ["img/a.jpg", "img/b.jpg"],
      },
    });
    const res = createMockResponse();

    await controller.initStructure(req, res);

    expect(mockUgcScriptService.initStructure).toHaveBeenCalledWith({
      message: "Analyze these images",
      productImageKeys: ["img/a.jpg", "img/b.jpg"],
    });
  });

  it("returns 500 when service throws", async () => {
    mockUgcScriptService.initStructure.mockRejectedValue(
      new Error("Agent service unavailable"),
    );

    const req = createMockRequest({
      body: { message: "Make me a video" },
    });
    const res = createMockResponse();

    await controller.initStructure(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});
