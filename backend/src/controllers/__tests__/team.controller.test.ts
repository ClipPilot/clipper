import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { AuthRequest } from "../../middleware/auth.middleware";

const { mockTeamService, mockUserService, mockClipManagerService, mockS3Service } = vi.hoisted(() => ({
  mockTeamService: {
    getUserTeams: vi.fn(),
    getUserDefaultTeam: vi.fn(),
    getTeamUsageStats: vi.fn(),
    getTeamById: vi.fn(),
    verifyTeamAccess: vi.fn(),
    getTeamMembers: vi.fn(),
    getUserTeamRole: vi.fn(),
    addTeamMember: vi.fn(),
    removeTeamMember: vi.fn(),
    getMemberRoleById: vi.fn(),
    updateTeamMemberRole: vi.fn(),
    leaveTeam: vi.fn(),
    updateTeamName: vi.fn(),
    deleteTeam: vi.fn(),
    canUserCreateTeam: vi.fn(),
    createTeam: vi.fn(),
    getTeamMember: vi.fn(),
    updateTeamLogo: vi.fn(),
  },
  mockUserService: {
    getUserBySupabaseUid: vi.fn(),
    ensureUserHasTeam: vi.fn(),
  },
  mockClipManagerService: {
    getTeamClipsCount: vi.fn(),
  },
  mockS3Service: {
    uploadTeamLogo: vi.fn(),
    getPresignedUrl: vi.fn(),
  },
}));

vi.mock("../../services/team.service", () => ({ teamService: mockTeamService }));
vi.mock("../../services/user.service", () => ({ userService: mockUserService }));
vi.mock("../../services/clips/clipManager.service", () => ({ clipManagerService: mockClipManagerService }));
vi.mock("../../services/s3.service", () => ({ s3Service: mockS3Service }));

import {
  getUserTeamsController,
  getDefaultTeamController,
  getTeamUsageStatsController,
  getTeamMembersController,
  addTeamMemberController,
  removeTeamMemberController,
  updateTeamMemberRoleController,
  leaveTeamController,
  updateTeamNameController,
  deleteTeamController,
  createTeamController,
} from "../team.controller";

function createReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as AuthRequest;
}

describe("getUserTeamsController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq();
    const res = createMockResponse();
    await getUserTeamsController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns teams on success", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockUserService.ensureUserHasTeam.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeams.mockResolvedValue([{ id: 10, name: "Team" }]);

    const req = createReq({ user: { id: "supa-1", email: "t@t.com", dbUserId: 1 } });
    const res = createMockResponse();
    await getUserTeamsController(req, res);
    expect(res.json).toHaveBeenCalledWith({ teams: [{ id: 10, name: "Team" }] });
  });
});

describe("getDefaultTeamController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq();
    const res = createMockResponse();
    await getDefaultTeamController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns default team on success", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockUserService.ensureUserHasTeam.mockResolvedValue({ id: 1 });
    mockTeamService.getUserDefaultTeam.mockResolvedValue({ id: 10 });

    const req = createReq({ user: { id: "supa-1", email: "t@t.com", dbUserId: 1 } });
    const res = createMockResponse();
    await getDefaultTeamController(req, res);
    expect(res.json).toHaveBeenCalledWith({ id: 10 });
  });
});

describe("getTeamUsageStatsController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await getTeamUsageStatsController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, params: { teamId: "abc" } });
    const res = createMockResponse();
    await getTeamUsageStatsController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when user has no access", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.verifyTeamAccess.mockResolvedValue(false);

    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, params: { teamId: "5" } });
    const res = createMockResponse();
    await getTeamUsageStatsController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("getTeamMembersController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when no access", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.verifyTeamAccess.mockResolvedValue(false);

    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, params: { teamId: "5" } });
    const res = createMockResponse();
    await getTeamMembersController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns members on success", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.verifyTeamAccess.mockResolvedValue(true);
    mockTeamService.getTeamMembers.mockResolvedValue([{ id: 1, role: "owner" }]);

    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, params: { teamId: "5" } });
    const res = createMockResponse();
    await getTeamMembersController(req, res);
    expect(res.json).toHaveBeenCalledWith({ members: [{ id: 1, role: "owner" }] });
  });
});

describe("addTeamMemberController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when email missing", async () => {
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, params: { teamId: "5" }, body: {} });
    const res = createMockResponse();
    await addTeamMemberController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 for non-scale plan", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "free" });
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5" },
      body: { email: "new@t.com" },
    });
    const res = createMockResponse();
    await addTeamMemberController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when user is not owner/manager", async () => {
    mockTeamService.getTeamById.mockResolvedValue({ plan: "scale" });
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("member");
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5" },
      body: { email: "new@t.com" },
    });
    const res = createMockResponse();
    await addTeamMemberController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("removeTeamMemberController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when manager tries to remove owner", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("manager");
    mockTeamService.getMemberRoleById.mockResolvedValue("owner");

    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5", memberId: "2" },
    });
    const res = createMockResponse();
    await removeTeamMemberController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Managers cannot remove owners" });
  });
});

describe("updateTeamMemberRoleController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid role", async () => {
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5", memberId: "2" },
      body: { role: "superadmin" },
    });
    const res = createMockResponse();
    await updateTeamMemberRoleController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 for non-owners", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("manager");
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5", memberId: "2" },
      body: { role: "member" },
    });
    const res = createMockResponse();
    await updateTeamMemberRoleController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("createTeamController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when name missing", async () => {
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, body: {} });
    const res = createMockResponse();
    await createTeamController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when user can't create team", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.canUserCreateTeam.mockResolvedValue({ canCreate: false, reason: "Limit reached" });
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, body: { name: "New" } });
    const res = createMockResponse();
    await createTeamController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 201 on success", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.canUserCreateTeam.mockResolvedValue({ canCreate: true });
    mockTeamService.createTeam.mockResolvedValue({ id: 20, name: "New" });
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, body: { name: "New" } });
    const res = createMockResponse();
    await createTeamController(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("updateTeamNameController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when name empty", async () => {
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, params: { teamId: "5" }, body: { name: "" } });
    const res = createMockResponse();
    await updateTeamNameController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 for non-owners", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("member");
    const req = createReq({
      user: { id: "s", email: "t@t.com", dbUserId: 1 },
      params: { teamId: "5" },
      body: { name: "Renamed" },
    });
    const res = createMockResponse();
    await updateTeamNameController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("deleteTeamController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-owners", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("member");
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, params: { teamId: "5" } });
    const res = createMockResponse();
    await deleteTeamController(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns success when owner deletes", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.getUserTeamRole.mockResolvedValue("owner");
    mockTeamService.deleteTeam.mockResolvedValue(undefined);
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, params: { teamId: "5" } });
    const res = createMockResponse();
    await deleteTeamController(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: "Team deleted successfully" });
  });
});

describe("leaveTeamController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await leaveTeamController(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns success", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.leaveTeam.mockResolvedValue(undefined);
    const req = createReq({ user: { id: "s", email: "t@t.com", dbUserId: 1 }, params: { teamId: "5" } });
    const res = createMockResponse();
    await leaveTeamController(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: "Left team successfully" });
  });
});
