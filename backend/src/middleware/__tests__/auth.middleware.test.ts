import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
} from "../../../test/helpers/express.helper";
import { createDrizzleChain } from "../../../test/helpers/db.helper";
import { buildUser } from "../../../test/factories";

// vi.hoisted runs BEFORE vi.mock hoisting — so these variables are available in factories
const { mockVerifyToken, mockCanMemberPerformActions, mockDb } = vi.hoisted(() => ({
  mockVerifyToken: vi.fn(),
  mockCanMemberPerformActions: vi.fn(),
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../services/auth.service", () => ({
  authService: { verifyToken: mockVerifyToken },
}));

vi.mock("../../services/team.service", () => ({
  teamService: { canMemberPerformActions: mockCanMemberPerformActions },
}));

vi.mock("../../db", () => ({ db: mockDb }));

import { requireAuth, requireSeatAccess } from "../auth.middleware";

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no authorization header", async () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing or invalid authorization header",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when header doesn't start with Bearer", async () => {
    const req = createMockRequest({
      headers: { authorization: "Basic abc123" } as any,
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when token is invalid", async () => {
    mockVerifyToken.mockResolvedValue(null);

    const req = createMockRequest({
      headers: { authorization: "Bearer bad-token" } as any,
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid or expired token",
    });
  });

  it("returns 401 when user not found in database", async () => {
    mockVerifyToken.mockResolvedValue({ id: "supa-1", email: "test@test.com" });
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const req = createMockRequest({
      headers: { authorization: "Bearer valid-token" } as any,
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "User not found in database",
    });
  });

  it("returns 503 on network error (ETIMEDOUT)", async () => {
    const networkError = new Error("fetch failed") as Error & { code?: string };
    networkError.code = "ETIMEDOUT";
    mockVerifyToken.mockRejectedValue(networkError);

    const req = createMockRequest({
      headers: { authorization: "Bearer valid-token" } as any,
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Service temporarily unavailable",
    });
  });

  it("populates req.user and calls next on success", async () => {
    const dbUser = buildUser({ id: 42, supabase_uid: "supa-42" });
    mockVerifyToken.mockResolvedValue({ id: "supa-42", email: "user@test.com" });
    mockDb.select.mockReturnValue(createDrizzleChain([dbUser]));

    const req = createMockRequest({
      headers: { authorization: "Bearer valid-token" } as any,
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireAuth(req, res, next);

    expect(req.user).toEqual({
      id: "supa-42",
      email: "user@test.com",
      dbUserId: 42,
    });
    expect(next).toHaveBeenCalled();
  });
});

describe("requireSeatAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user on request", async () => {
    const req = createMockRequest({ params: { teamId: "1" } });
    const res = createMockResponse();
    const next = createMockNext();

    await requireSeatAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 for invalid teamId", async () => {
    const req = createMockRequest({
      user: { id: "supa-1", email: "u@t.com", dbUserId: 1 },
      params: { teamId: "abc" },
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireSeatAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when over seat limit", async () => {
    mockCanMemberPerformActions.mockResolvedValue({
      allowed: false,
      reason: "Over seat limit",
    });

    const req = createMockRequest({
      user: { id: "supa-1", email: "u@t.com", dbUserId: 1 },
      params: { teamId: "5" },
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireSeatAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SEAT_LIMIT_EXCEEDED" })
    );
  });

  it("calls next and sets seatCheckPassed on success", async () => {
    mockCanMemberPerformActions.mockResolvedValue({ allowed: true });

    const req = createMockRequest({
      user: { id: "supa-1", email: "u@t.com", dbUserId: 1 },
      params: { teamId: "5" },
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireSeatAccess(req, res, next);

    expect(req.seatCheckPassed).toBe(true);
    expect(next).toHaveBeenCalled();
  });
});
