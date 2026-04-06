import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { createDrizzleChain } from "../../../test/helpers/db.helper";
import crypto from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(crypto.scrypt);

async function generateTestHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(32).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

let TEST_PASSWORD_HASH: string;

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

beforeAll(async () => {
  TEST_PASSWORD_HASH = await generateTestHash("secret123");
  process.env.ADMIN_EMAIL = "admin@cuttr.com";
  process.env.ADMIN_PASSWORD_HASH = TEST_PASSWORD_HASH;
  process.env.ADMIN_JWT_SECRET = "test-jwt-secret-for-tests";
});

const { adminService } = await import("../admin.service");

describe("AdminService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("validateCredentials", () => {
    it("returns true for valid credentials", async () => {
      expect(await adminService.validateCredentials("admin@cuttr.com", "secret123")).toBe(true);
    });

    it("returns false for wrong email", async () => {
      expect(await adminService.validateCredentials("wrong@cuttr.com", "secret123")).toBe(false);
    });

    it("returns false for wrong password", async () => {
      expect(await adminService.validateCredentials("admin@cuttr.com", "wrong")).toBe(false);
    });

    it("uses crypto.scrypt (not plaintext comparison)", async () => {
      const hash = process.env.ADMIN_PASSWORD_HASH!;
      expect(hash).toContain(":");
      expect(hash.split(":")[0].length).toBe(64);
    });
  });

  describe("generateToken", () => {
    it("calls jwt.sign with 4h expiry (not 7d)", () => {
      mockJwt.sign.mockReturnValue("token-123");
      const result = adminService.generateToken("admin@cuttr.com");
      expect(mockJwt.sign).toHaveBeenCalledWith(
        { email: "admin@cuttr.com", isAdmin: true },
        "test-jwt-secret-for-tests",
        { expiresIn: "4h" }
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

  describe("generate2FACode (via send2FACode)", () => {
    it("generates 6-digit code using crypto.randomInt (not Math.random)", async () => {
      mockSendAdmin2FA.mockResolvedValue(undefined);
      const spy = vi.spyOn(crypto, "randomInt");
      await adminService.send2FACode("admin@cuttr.com");
      expect(spy).toHaveBeenCalledWith(100000, 999999);
      spy.mockRestore();
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
