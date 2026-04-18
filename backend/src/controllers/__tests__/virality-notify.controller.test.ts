import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { Request } from "express";

const { mockViralityService } = vi.hoisted(() => ({
  mockViralityService: {
    checkTeamPlanAccess: vi.fn().mockResolvedValue(true),
    notifyAlert: vi.fn(),
    getAlertLogs: vi.fn().mockResolvedValue([]),
    getAlertLogsCount: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("../../services/virality/virality.service", () => ({
  viralityService: mockViralityService,
}));

vi.mock("../../services/virality/userPerformance.service", () => ({
  userPerformanceService: { syncAccount: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../utils/controllerHelpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/controllerHelpers")>();
  return {
    ...actual,
    verifyTeamAccessOrFail: vi.fn().mockResolvedValue({ id: 1 }),
  };
});

import { viralityController } from "../virality.controller";

function createReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as Request;
}

describe("ViralityController.notifyAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "abc", alertId: "42" } });
    const res = createMockResponse();
    await viralityController.notifyAlert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for invalid alertId", async () => {
    const req = createReq({ params: { teamId: "1", alertId: "abc" } });
    const res = createMockResponse();
    await viralityController.notifyAlert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("calls notifyAlert and returns success", async () => {
    mockViralityService.notifyAlert.mockResolvedValue(undefined);
    const req = createReq({ params: { teamId: "1", alertId: "42" } });
    const res = createMockResponse();
    await viralityController.notifyAlert(req, res);
    expect(mockViralityService.notifyAlert).toHaveBeenCalledWith(1, 42);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("returns 403 when plan access is denied", async () => {
    mockViralityService.checkTeamPlanAccess.mockResolvedValueOnce(false);
    const req = createReq({ params: { teamId: "1", alertId: "42" } });
    const res = createMockResponse();
    await viralityController.notifyAlert(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 on service error", async () => {
    mockViralityService.notifyAlert.mockRejectedValue(new Error("send failed"));
    const req = createReq({ params: { teamId: "1", alertId: "42" } });
    const res = createMockResponse();
    await viralityController.notifyAlert(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ViralityController.getAlertLogs (with total)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "abc" } });
    const res = createMockResponse();
    await viralityController.getAlertLogs(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns logs and total", async () => {
    mockViralityService.getAlertLogs.mockResolvedValue([{ id: 1, subject: "test" }]);
    mockViralityService.getAlertLogsCount.mockResolvedValue(1);
    const req = createReq({ params: { teamId: "5" }, query: {} });
    const res = createMockResponse();
    await viralityController.getAlertLogs(req, res);
    expect(res.json).toHaveBeenCalledWith({
      logs: [{ id: 1, subject: "test" }],
      total: 1,
    });
  });

  it("calls service with correct limit and offset", async () => {
    mockViralityService.getAlertLogs.mockResolvedValue([]);
    mockViralityService.getAlertLogsCount.mockResolvedValue(0);
    const req = createReq({ params: { teamId: "5" }, query: { limit: "10", offset: "20" } });
    const res = createMockResponse();
    await viralityController.getAlertLogs(req, res);
    expect(mockViralityService.getAlertLogs).toHaveBeenCalledWith(5, 10, 20);
  });

  it("returns 500 on service error", async () => {
    mockViralityService.getAlertLogs.mockRejectedValue(new Error("DB error"));
    const req = createReq({ params: { teamId: "5" }, query: {} });
    const res = createMockResponse();
    await viralityController.getAlertLogs(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
