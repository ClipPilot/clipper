import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../test/helpers/db.helper";

const { mockDb, mockSupabaseAuth, mockSupabaseAdminAuth, mockAcceptAllPending } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  mockSupabaseAuth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    getUser: vi.fn(),
    refreshSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    admin: null as any,
  },
  mockSupabaseAdminAuth: {
    signOut: vi.fn(),
    updateUserById: vi.fn(),
  },
  mockAcceptAllPending: vi.fn(),
}));

// Wire admin into auth
mockSupabaseAuth.admin = mockSupabaseAdminAuth;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: mockSupabaseAuth }),
}));
vi.mock("../../db", () => ({ db: mockDb }));
vi.mock("../../config/env", () => ({
  ENV: { SUPABASE_URL: "http://localhost", SUPABASE_ANON_KEY: "key" },
}));
vi.mock("../teamInvite.service", () => ({
  teamInviteService: { acceptAllPendingInvitesForUser: mockAcceptAllPending },
}));

import { authService } from "../auth.service";

describe("AuthService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("signUp", () => {
    it("throws when email already exists in DB", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, email: "a@b.com" }]));

      await expect(
        authService.signUp("a@b.com", "pass", "A", "B")
      ).rejects.toThrow("already exists");
    });

    it("throws when Supabase returns error", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: "Signup disabled" },
      });

      await expect(
        authService.signUp("a@b.com", "pass", "A", "B")
      ).rejects.toThrow("Signup disabled");
    });

    it("throws when identities array is empty (duplicate unconfirmed)", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: { id: "uid-1", identities: [] } },
        error: null,
      });

      await expect(
        authService.signUp("a@b.com", "pass", "A", "B")
      ).rejects.toThrow("already exists");
    });

    it("creates user, team, usage stats, and accepts invites on success", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: { id: "uid-1", identities: [{ id: "1" }] } },
        error: null,
      });
      // Insert calls: user, team, teamMember, usageStats
      mockDb.insert.mockReturnValue(createDrizzleChain([{ id: 1 }]));
      mockAcceptAllPending.mockResolvedValue([]);

      const result = await authService.signUp("a@b.com", "pass", "Alice", "Smith");
      expect(result.emailConfirmationRequired).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockAcceptAllPending).toHaveBeenCalledWith(1, "a@b.com");
    });
  });

  describe("signIn", () => {
    it("throws when Supabase returns error", async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "Invalid credentials" },
      });

      await expect(authService.signIn("a@b.com", "bad")).rejects.toThrow("Invalid credentials");
    });

    it("throws when email not confirmed", async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: { id: "uid-1", email_confirmed_at: null }, session: {} },
        error: null,
      });

      await expect(authService.signIn("a@b.com", "pass")).rejects.toThrow("confirm your email");
    });

    it("returns user and session on success", async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: "uid-1", email_confirmed_at: "2024-01-01" },
          session: { access_token: "tok" },
        },
        error: null,
      });
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, email: "a@b.com" }]));

      const result = await authService.signIn("a@b.com", "pass");
      expect(result.session.access_token).toBe("tok");
      expect(result.dbUser).toEqual({ id: 1, email: "a@b.com" });
    });
  });

  describe("signInWithSupabase", () => {
    it("throws when token is invalid", async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Bad token" },
      });

      await expect(authService.signInWithSupabase("bad", "ref")).rejects.toThrow("Invalid Supabase token");
    });

    it("creates new user if not in DB (first-time Google login)", async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: {
          user: {
            id: "uid-1",
            email: "g@google.com",
            user_metadata: { full_name: "Alice Smith" },
          },
        },
        error: null,
      });
      // First select: no existing user
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      // Inserts: user, team, teamMember, usageStats
      mockDb.insert.mockReturnValue(createDrizzleChain([{ id: 1 }]));
      mockAcceptAllPending.mockResolvedValue([]);

      const result = await authService.signInWithSupabase("tok", "ref");
      expect(result.dbUser).toEqual({ id: 1 });
      expect(mockAcceptAllPending).toHaveBeenCalled();
    });

    it("returns existing user if already in DB", async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: "uid-1", email: "a@b.com" } },
        error: null,
      });
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 5, email: "a@b.com" }]));

      const result = await authService.signInWithSupabase("tok", "ref");
      expect(result.dbUser).toEqual({ id: 5, email: "a@b.com" });
    });
  });

  describe("signOut", () => {
    it("throws on error", async () => {
      mockSupabaseAdminAuth.signOut.mockResolvedValue({ error: { message: "Failed" } });
      await expect(authService.signOut("tok")).rejects.toThrow("Failed");
    });

    it("returns success message", async () => {
      mockSupabaseAdminAuth.signOut.mockResolvedValue({ error: null });
      const result = await authService.signOut("tok");
      expect(result.message).toBe("Signed out successfully");
    });
  });

  describe("verifyToken", () => {
    it("returns null on error", async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "expired" },
      });
      const result = await authService.verifyToken("bad");
      expect(result).toBeNull();
    });

    it("returns user on success", async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: "uid-1" } },
        error: null,
      });
      const result = await authService.verifyToken("tok");
      expect(result).toEqual({ id: "uid-1" });
    });
  });

  describe("refreshSession", () => {
    it("throws on error", async () => {
      mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: {},
        error: { message: "Token expired" },
      });
      await expect(authService.refreshSession("bad")).rejects.toThrow("Token expired");
    });

    it("returns session and user", async () => {
      mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: { session: { access_token: "new" }, user: { id: "uid-1" } },
        error: null,
      });
      const result = await authService.refreshSession("ref-tok");
      expect(result.session.access_token).toBe("new");
    });
  });

  describe("resetPassword", () => {
    it("throws on error", async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        error: { message: "Rate limited" },
      });
      await expect(authService.resetPassword("a@b.com")).rejects.toThrow("Rate limited");
    });

    it("returns success message", async () => {
      mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
      const result = await authService.resetPassword("a@b.com");
      expect(result.message).toContain("Password reset email sent");
    });
  });
});
