import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockResponse,
  createMockNext,
} from "../../../test/helpers/express.helper";
import type { AdminRequest } from "../admin.middleware";

const { mockVerifyToken } = vi.hoisted(() => ({
  mockVerifyToken: vi.fn(),
}));

vi.mock("../../services/admin.service", () => ({
  adminService: { verifyToken: mockVerifyToken },
}));

import { requireAdminAuth } from "../admin.middleware";

function createAdminRequest(
  overrides: Partial<AdminRequest> = {}
): AdminRequest {
  return {
    headers: {},
    params: {},
    body: {},
    query: {},
    ...overrides,
  } as AdminRequest;
}

describe("requireAdminAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no authorization header", async () => {
    const req = createAdminRequest();
    const res = createMockResponse();
    const next = createMockNext();

    await requireAdminAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing authorization header",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when header doesn't start with Bearer", async () => {
    const req = createAdminRequest({
      headers: { authorization: "Basic abc123" } as any,
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireAdminAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing authorization header",
    });
  });

  it("returns 401 when verifyToken returns null", async () => {
    mockVerifyToken.mockReturnValue(null);

    const req = createAdminRequest({
      headers: { authorization: "Bearer bad-token" } as any,
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireAdminAuth(req, res, next);

    expect(mockVerifyToken).toHaveBeenCalledWith("bad-token");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid or expired admin token",
    });
  });

  it("returns 401 when token payload has isAdmin false", async () => {
    mockVerifyToken.mockReturnValue({ email: "admin@test.com", isAdmin: false });

    const req = createAdminRequest({
      headers: { authorization: "Bearer token" } as any,
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireAdminAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid or expired admin token",
    });
  });

  it("returns 401 when verifyToken throws", async () => {
    mockVerifyToken.mockImplementation(() => {
      throw new Error("JWT malformed");
    });

    const req = createAdminRequest({
      headers: { authorization: "Bearer corrupt" } as any,
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireAdminAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Authentication failed",
    });
  });

  it("populates req.admin and calls next on success", async () => {
    const adminPayload = { email: "admin@cuttr.com", isAdmin: true };
    mockVerifyToken.mockReturnValue(adminPayload);

    const req = createAdminRequest({
      headers: { authorization: "Bearer valid-admin-token" } as any,
    });
    const res = createMockResponse();
    const next = createMockNext();

    await requireAdminAuth(req, res, next);

    expect(req.admin).toEqual(adminPayload);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
