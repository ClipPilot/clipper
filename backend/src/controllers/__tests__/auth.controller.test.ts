import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockResponse,
} from "../../../test/helpers/express.helper";
import type { Request, Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware";

const { mockAuthService, mockUserService } = vi.hoisted(() => ({
  mockAuthService: {
    signUp: vi.fn(),
    signIn: vi.fn(),
    signInWithSupabase: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    refreshSession: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
  },
  mockUserService: {
    getUserBySupabaseUid: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock("../../services/auth.service", () => ({
  authService: mockAuthService,
}));

vi.mock("../../services/user.service", () => ({
  userService: mockUserService,
}));

import { authController } from "../auth.controller";

function createReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    params: {},
    body: {},
    query: {},
    ...overrides,
  } as Request;
}

function createAuthReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    headers: {},
    params: {},
    body: {},
    query: {},
    ...overrides,
  } as AuthRequest;
}

const fakeDbUser = {
  id: 1,
  email: "test@test.com",
  first_name: "Test",
  last_name: "User",
};

const fakeSession = { access_token: "at", refresh_token: "rt" };

describe("AuthController.signUp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when required fields are missing", async () => {
    const req = createReq({ body: { email: "a@b.com" } });
    const res = createMockResponse();

    await authController.signUp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Missing required fields") })
    );
  });

  it("returns 201 on successful signup", async () => {
    mockAuthService.signUp.mockResolvedValue({
      dbUser: fakeDbUser,
      session: fakeSession,
    });

    const req = createReq({
      body: {
        email: "test@test.com",
        password: "pass123",
        firstName: "Test",
        lastName: "User",
      },
    });
    const res = createMockResponse();

    await authController.signUp(req, res);

    expect(mockAuthService.signUp).toHaveBeenCalledWith(
      "test@test.com", "pass123", "Test", "User"
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "User created successfully",
        user: expect.objectContaining({ email: "test@test.com" }),
        session: fakeSession,
      })
    );
  });

  it("returns 400 when service throws", async () => {
    mockAuthService.signUp.mockRejectedValue(new Error("Email already exists"));

    const req = createReq({
      body: {
        email: "dup@test.com",
        password: "pass",
        firstName: "A",
        lastName: "B",
      },
    });
    const res = createMockResponse();

    await authController.signUp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email already exists" });
  });
});

describe("AuthController.signIn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when email or password missing", async () => {
    const req = createReq({ body: { email: "a@b.com" } });
    const res = createMockResponse();

    await authController.signIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on successful signin", async () => {
    mockAuthService.signIn.mockResolvedValue({
      dbUser: fakeDbUser,
      session: fakeSession,
      rememberMe: true,
    });

    const req = createReq({
      body: { email: "test@test.com", password: "pass", rememberMe: true },
    });
    const res = createMockResponse();

    await authController.signIn(req, res);

    expect(mockAuthService.signIn).toHaveBeenCalledWith("test@test.com", "pass", true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ rememberMe: true })
    );
  });

  it("returns 401 when credentials are wrong", async () => {
    mockAuthService.signIn.mockRejectedValue(new Error("Invalid credentials"));

    const req = createReq({
      body: { email: "test@test.com", password: "wrong" },
    });
    const res = createMockResponse();

    await authController.signIn(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials" });
  });
});

describe("AuthController.signInWithSupabase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when tokens are missing", async () => {
    const req = createReq({ body: { accessToken: "at" } });
    const res = createMockResponse();

    await authController.signInWithSupabase(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on success", async () => {
    mockAuthService.signInWithSupabase.mockResolvedValue({
      dbUser: fakeDbUser,
      session: fakeSession,
    });

    const req = createReq({
      body: { accessToken: "at", refreshToken: "rt" },
    });
    const res = createMockResponse();

    await authController.signInWithSupabase(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("AuthController.signOut", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no auth header", async () => {
    const req = createReq();
    const res = createMockResponse();

    await authController.signOut(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 200 on successful signout", async () => {
    mockAuthService.signOut.mockResolvedValue(undefined);

    const req = createReq({
      headers: { authorization: "Bearer token123" } as any,
    });
    const res = createMockResponse();

    await authController.signOut(req, res);

    expect(mockAuthService.signOut).toHaveBeenCalledWith("token123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Signed out successfully" });
  });
});

describe("AuthController.getMe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no auth header", async () => {
    const req = createReq();
    const res = createMockResponse();

    await authController.getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns user data on success", async () => {
    mockAuthService.getUser.mockResolvedValue({ dbUser: fakeDbUser });

    const req = createReq({
      headers: { authorization: "Bearer valid" } as any,
    });
    const res = createMockResponse();

    await authController.getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      user: {
        id: "1",
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
      },
    });
  });
});

describe("AuthController.refreshSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when refreshToken is missing", async () => {
    const req = createReq({ body: {} });
    const res = createMockResponse();

    await authController.refreshSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with new session", async () => {
    mockAuthService.refreshSession.mockResolvedValue({
      session: fakeSession,
      user: { id: "1", email: "test@test.com" },
    });

    const req = createReq({ body: { refreshToken: "rt" } });
    const res = createMockResponse();

    await authController.refreshSession(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ session: fakeSession })
    );
  });
});

describe("AuthController.resetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when email is missing", async () => {
    const req = createReq({ body: {} });
    const res = createMockResponse();

    await authController.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on success", async () => {
    mockAuthService.resetPassword.mockResolvedValue({ message: "Email sent" });

    const req = createReq({ body: { email: "test@test.com" } });
    const res = createMockResponse();

    await authController.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("AuthController.updatePassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no auth header", async () => {
    const req = createReq({ body: { password: "new" } });
    const res = createMockResponse();

    await authController.updatePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when password missing", async () => {
    const req = createReq({
      headers: { authorization: "Bearer token" } as any,
      body: {},
    });
    const res = createMockResponse();

    await authController.updatePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on success", async () => {
    mockAuthService.updatePassword.mockResolvedValue({
      dbUser: fakeDbUser,
      session: fakeSession,
    });

    const req = createReq({
      headers: { authorization: "Bearer token" } as any,
      body: { password: "newPass123" },
    });
    const res = createMockResponse();

    await authController.updatePassword(req, res);

    expect(mockAuthService.updatePassword).toHaveBeenCalledWith("token", "newPass123");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("AuthController.updateProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when req.user is missing", async () => {
    const req = createAuthReq({ body: { firstName: "New" } });
    const res = createMockResponse();

    await authController.updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 200 with updated user", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockUserService.updateUser.mockResolvedValue({
      id: 1,
      email: "test@test.com",
      first_name: "Updated",
      last_name: "Name",
    });

    const req = createAuthReq({
      user: { id: "supa-1", email: "test@test.com", dbUserId: 1 },
      body: { firstName: "Updated", lastName: "Name" },
    });
    const res = createMockResponse();

    await authController.updateProfile(req, res);

    expect(mockUserService.getUserBySupabaseUid).toHaveBeenCalledWith("supa-1");
    expect(mockUserService.updateUser).toHaveBeenCalledWith(1, {
      firstName: "Updated",
      lastName: "Name",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ firstName: "Updated" }),
      })
    );
  });

  it("returns 400 when service throws", async () => {
    mockUserService.getUserBySupabaseUid.mockRejectedValue(
      new Error("User not found")
    );

    const req = createAuthReq({
      user: { id: "supa-1", email: "t@t.com", dbUserId: 1 },
      body: { firstName: "X" },
    });
    const res = createMockResponse();

    await authController.updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
  });
});
