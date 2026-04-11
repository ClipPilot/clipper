import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { Request } from "express";

const { mockViralityService } = vi.hoisted(() => ({
  mockViralityService: {
    getAllGroupsWithAccounts: vi.fn(),
    getPostsForTeam: vi.fn(),
    getCompetitorsByTeam: vi.fn(),
    getDashboardStats: vi.fn(),
    checkTeamPlanAccess: vi.fn().mockResolvedValue(true),
    getCompetitorWithAccounts: vi.fn(),
    getAccountsByTeam: vi.fn(),
    getAccountById: vi.fn(),
    addAccount: vi.fn(),
    deleteAccount: vi.fn(),
    updateAccountStatus: vi.fn(),
    syncAccount: vi.fn(),
    getPostsByAccount: vi.fn(),
    deletePost: vi.fn(),
    createCompetitor: vi.fn(),
    updateCompetitor: vi.fn(),
    deleteCompetitor: vi.fn(),
    updateAlertEnabled: vi.fn(),
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    getAlertLogs: vi.fn(),
  },
}));

vi.mock("../../services/virality/virality.service", () => ({
  viralityService: mockViralityService,
}));

import { viralityController } from "../virality.controller";

function createReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as Request;
}

describe("ViralityController.listGroupsWithAccounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "abc" } });
    const res = createMockResponse();
    await viralityController.listGroupsWithAccounts(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when plan access is denied", async () => {
    mockViralityService.checkTeamPlanAccess.mockResolvedValueOnce(false);
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await viralityController.listGroupsWithAccounts(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns competitors with accounts on success", async () => {
    const competitors = [
      { id: 1, name: "Comp A", accounts: [{ id: 10, username: "user10" }] },
      { id: 2, name: "Comp B", accounts: [] },
    ];
    mockViralityService.getAllGroupsWithAccounts.mockResolvedValue(competitors);
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();

    await viralityController.listGroupsWithAccounts(req, res);

    expect(mockViralityService.getAllGroupsWithAccounts).toHaveBeenCalledWith(5);
    expect(res.json).toHaveBeenCalledWith({ competitors });
  });

  it("returns 500 on service error", async () => {
    mockViralityService.getAllGroupsWithAccounts.mockRejectedValue(new Error("DB error"));
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await viralityController.listGroupsWithAccounts(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ViralityController.getAllPosts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "abc" } });
    const res = createMockResponse();
    await viralityController.getAllPosts(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when plan access is denied", async () => {
    mockViralityService.checkTeamPlanAccess.mockResolvedValueOnce(false);
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await viralityController.getAllPosts(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns posts grouped by account without date filters", async () => {
    const postsByAccount = {
      10: [{ id: 1, caption: "post1" }],
      20: [{ id: 2, caption: "post2" }, { id: 3, caption: "post3" }],
    };
    mockViralityService.getPostsForTeam.mockResolvedValue(postsByAccount);
    const req = createReq({ params: { teamId: "5" }, query: {} });
    const res = createMockResponse();

    await viralityController.getAllPosts(req, res);

    expect(mockViralityService.getPostsForTeam).toHaveBeenCalledWith(5, undefined, undefined);
    expect(res.json).toHaveBeenCalledWith({ postsByAccount });
  });

  it("passes date filters to service", async () => {
    mockViralityService.getPostsForTeam.mockResolvedValue({});
    const req = createReq({
      params: { teamId: "5" },
      query: { startDate: "2026-01-01", endDate: "2026-02-01" },
    });
    const res = createMockResponse();

    await viralityController.getAllPosts(req, res);

    const [teamId, startDate, endDate] = mockViralityService.getPostsForTeam.mock.calls[0];
    expect(teamId).toBe(5);
    expect(startDate).toBeDefined();
    expect(endDate).toBeDefined();
  });

  it("returns 500 on service error", async () => {
    mockViralityService.getPostsForTeam.mockRejectedValue(new Error("DB error"));
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await viralityController.getAllPosts(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
