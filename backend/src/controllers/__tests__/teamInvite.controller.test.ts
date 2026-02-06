import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { AuthRequest } from "../../middleware/auth.middleware";
import type { Request } from "express";

const { mockTeamInviteService, mockTeamService, mockUserService } = vi.hoisted(() => ({
  mockTeamInviteService: {
    createInvite: vi.fn(),
    getTeamInvites: vi.fn(),
    getInviteByToken: vi.fn(),
    acceptInvite: vi.fn(),
    revokeInvite: vi.fn(),
    resendInvite: vi.fn(),
  },
  mockTeamService: {
    getUserTeamRole: vi.fn(),
    verifyTeamAccess: vi.fn(),
  },
  mockUserService: {
    getUserBySupabaseUid: vi.fn(),
  },
}));

vi.mock("../../services/teamInvite.service", () => ({ teamInviteService: mockTeamInviteService }));
vi.mock("../../services/team.service", () => ({ teamService: mockTeamService }));
vi.mock("../../services/user.service", () => ({ userService: mockUserService }));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

import {
  createInviteController,
  getTeamInvitesController,
  getInviteByTokenController,
  acceptInviteController,
  revokeInviteController,
  resendInviteController,
} from "../teamInvite.controller";

function createReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as AuthRequest;
}

describe("createInviteController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq();
    const res = createMockResponse();
    await createInviteController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, params: { teamId: "abc" } });
    const res = createMockResponse();
    await createInviteController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when email missing", async () => {
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5" },
      body: {},
    });
    const res = createMockResponse();
    await createInviteController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 for non-owner/manager", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("member");
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5" },
      body: { email: "new@test.com" },
    });
    const res = createMockResponse();
    await createInviteController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 201 on success", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("owner");
    mockTeamInviteService.createInvite.mockResolvedValue({ id: 10, email: "new@test.com" });
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5" },
      body: { email: "new@test.com" },
    });
    const res = createMockResponse();
    await createInviteController(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("getTeamInvitesController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when no access", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.verifyTeamAccess.mockResolvedValue(false);
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5" },
    });
    const res = createMockResponse();
    await getTeamInvitesController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns invites on success", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.verifyTeamAccess.mockResolvedValue(true);
    mockTeamInviteService.getTeamInvites.mockResolvedValue([{ id: 1, email: "a@b.com" }]);
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5" },
    });
    const res = createMockResponse();
    await getTeamInvitesController(req, res);
    expect(res.json).toHaveBeenCalledWith({ invites: [{ id: 1, email: "a@b.com" }] });
  });
});

describe("getInviteByTokenController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when token missing", async () => {
    const req = createReq({ params: {} }) as unknown as Request;
    const res = createMockResponse();
    await getInviteByTokenController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when invite not found", async () => {
    mockTeamInviteService.getInviteByToken.mockResolvedValue(null);
    const req = createReq({ params: { token: "bad" } }) as unknown as Request;
    const res = createMockResponse();
    await getInviteByTokenController(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 400 when invite is not pending", async () => {
    mockTeamInviteService.getInviteByToken.mockResolvedValue({ status: "accepted" });
    const req = createReq({ params: { token: "tok" } }) as unknown as Request;
    const res = createMockResponse();
    await getInviteByTokenController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns invite on success", async () => {
    const futureDate = new Date("2099-01-01").toISOString();
    mockTeamInviteService.getInviteByToken.mockResolvedValue({
      status: "pending",
      expiresAt: futureDate,
    });
    const req = createReq({ params: { token: "tok" } }) as unknown as Request;
    const res = createMockResponse();
    await getInviteByTokenController(req, res);
    expect(res.json).toHaveBeenCalledWith({
      invite: expect.objectContaining({ status: "pending" }),
    });
  });
});

describe("acceptInviteController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ params: { token: "tok" } });
    const res = createMockResponse();
    await acceptInviteController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns success on accept", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamInviteService.acceptInvite.mockResolvedValue({ team: { id: 5 }, role: "member" });
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { token: "tok" },
    });
    const res = createMockResponse();
    await acceptInviteController(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invite accepted successfully" })
    );
  });
});

describe("revokeInviteController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid IDs", async () => {
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "abc", inviteId: "1" },
    });
    const res = createMockResponse();
    await revokeInviteController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 for non-owner/manager", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("member");
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5", inviteId: "10" },
    });
    const res = createMockResponse();
    await revokeInviteController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns success on revoke", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("owner");
    mockTeamInviteService.revokeInvite.mockResolvedValue(undefined);
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5", inviteId: "10" },
    });
    const res = createMockResponse();
    await revokeInviteController(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: "Invite revoked successfully" });
  });
});

describe("resendInviteController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-owner/manager", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("member");
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5", inviteId: "10" },
    });
    const res = createMockResponse();
    await resendInviteController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns success on resend", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("manager");
    mockTeamInviteService.resendInvite.mockResolvedValue(undefined);
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5", inviteId: "10" },
    });
    const res = createMockResponse();
    await resendInviteController(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: "Invite resent successfully" });
  });
});
