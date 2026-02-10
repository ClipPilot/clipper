import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../test/helpers/db.helper";

const { mockDb, mockJwt, mockStripe, mockSendAdmin2FA } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  mockJwt: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
  mockStripe: {
    prices: { create: vi.fn() },
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
  mockSendAdmin2FA: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({ default: mockJwt }));
vi.mock("../../db", () => ({ db: mockDb }));
vi.mock("../../config/stripe.config", () => ({
  stripe: mockStripe,
  ENTERPRISE_PRODUCT: "prod_enterprise",
}));
vi.mock("../emailNoti.service", () => ({
  emailNotiService: { sendAdmin2FACode: mockSendAdmin2FA },
}));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));
vi.mock("ioredis", () => ({
  Redis: class MockRedis {
    ping = vi.fn().mockRejectedValue(new Error("not available"));
  },
}));
vi.mock("../../config/admin.config.json", () => ({
  default: {
    credentials: { email: "admin@cuttr.com", password: "secret123" },
  },
}));

import { adminService } from "../admin.service";

describe("AdminService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("validateCredentials", () => {
    it("returns true for valid credentials", () => {
      expect(adminService.validateCredentials("admin@cuttr.com", "secret123")).toBe(true);
    });

    it("returns false for wrong email", () => {
      expect(adminService.validateCredentials("wrong@cuttr.com", "secret123")).toBe(false);
    });

    it("returns false for wrong password", () => {
      expect(adminService.validateCredentials("admin@cuttr.com", "wrong")).toBe(false);
    });
  });

  describe("generateToken", () => {
    it("calls jwt.sign with correct payload", () => {
      mockJwt.sign.mockReturnValue("token-123");
      const result = adminService.generateToken("admin@cuttr.com");
      expect(mockJwt.sign).toHaveBeenCalledWith(
        { email: "admin@cuttr.com", isAdmin: true },
        expect.any(String),
        { expiresIn: "7d" }
      );
      expect(result).toBe("token-123");
    });
  });

  describe("verifyToken", () => {
    it("returns decoded payload on success", () => {
      mockJwt.verify.mockReturnValue({ email: "admin@cuttr.com", isAdmin: true });
      const result = adminService.verifyToken("valid-token");
      expect(result).toEqual({ email: "admin@cuttr.com", isAdmin: true });
    });

    it("returns null on invalid token", () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error("invalid");
      });
      const result = adminService.verifyToken("bad-token");
      expect(result).toBeNull();
    });
  });

  describe("store2FACode and verify2FACode (in-memory fallback)", () => {
    it("stores and verifies a code", async () => {
      await adminService.store2FACode("admin@cuttr.com", "123456");
      const result = await adminService.verify2FACode("admin@cuttr.com", "123456");
      expect(result).toBe(true);
    });

    it("rejects wrong code", async () => {
      await adminService.store2FACode("admin@cuttr.com", "123456");
      const result = await adminService.verify2FACode("admin@cuttr.com", "000000");
      expect(result).toBe(false);
    });

    it("consumes code after verification (one-time use)", async () => {
      await adminService.store2FACode("admin@cuttr.com", "111111");
      await adminService.verify2FACode("admin@cuttr.com", "111111");
      const result = await adminService.verify2FACode("admin@cuttr.com", "111111");
      expect(result).toBe(false);
    });
  });

  describe("send2FACode", () => {
    it("generates code and sends email", async () => {
      mockSendAdmin2FA.mockResolvedValue(undefined);
      await adminService.send2FACode("admin@cuttr.com");
      expect(mockSendAdmin2FA).toHaveBeenCalledWith(
        "contact@cuttr.com",
        expect.objectContaining({ code: expect.any(String) })
      );
      // Code should be 6 digits
      const code = mockSendAdmin2FA.mock.calls[0][1].code;
      expect(code).toMatch(/^\d{6}$/);
    });
  });

  describe("createEnterprisePrice", () => {
    it("creates Stripe price", async () => {
      mockStripe.prices.create.mockResolvedValue({ id: "price_123" });
      const result = await adminService.createEnterprisePrice(9900, 1, "Acme");
      expect(mockStripe.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          unit_amount: 9900,
          currency: "usd",
          product: "prod_enterprise",
        })
      );
      expect(result).toBe("price_123");
    });
  });

  describe("getTeamById", () => {
    it("returns team from DB", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, name: "Acme" }]));
      const result = await adminService.getTeamById(1);
      expect(result).toEqual({ id: 1, name: "Acme" });
    });

    it("returns undefined when team not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      const result = await adminService.getTeamById(999);
      expect(result).toBeUndefined();
    });
  });
});
