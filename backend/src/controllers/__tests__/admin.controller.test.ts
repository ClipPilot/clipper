import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { Request } from "express";

const { mockAdminService, mockReferralService } = vi.hoisted(() => ({
  mockAdminService: {
    validateCredentials: vi.fn(),
    send2FACode: vi.fn(),
    verify2FACode: vi.fn(),
    generateToken: vi.fn(),
    getAllTeams: vi.fn(),
    getTeamById: vi.fn(),
    setupEnterprise: vi.fn(),
    changePlanToEnterprise: vi.fn(),
  },
  mockReferralService: {
    getAllReferralsAdmin: vi.fn(),
    setReferralReward: vi.fn(),
  },
}));

vi.mock("../../services/admin.service", () => ({ adminService: mockAdminService }));
vi.mock("../../services/referral.service", () => ({ referralService: mockReferralService }));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

import {
  login,
  verify2FA,
  resend2FA,
  getAllTeams,
  getTeam,
  setupEnterprise,
  changePlan,
  getAllReferrals,
  setReferralReward,
} from "../admin.controller";

function createReq(overrides: Record<string, any> = {}): Request {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as unknown as Request;
}

describe("admin login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when email or password missing", async () => {
    const req = createReq({ body: { email: "a@b.com" } });
    const res = createMockResponse();
    await login(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 for invalid credentials", async () => {
    mockAdminService.validateCredentials.mockReturnValue(false);
    const req = createReq({ body: { email: "a@b.com", password: "wrong" } });
    const res = createMockResponse();
    await login(req as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("sends 2FA code on valid credentials", async () => {
    mockAdminService.validateCredentials.mockReturnValue(true);
    mockAdminService.send2FACode.mockResolvedValue(undefined);
    const req = createReq({ body: { email: "admin@cuttr.com", password: "secret" } });
    const res = createMockResponse();
    await login(req as any, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ requires2FA: true })
    );
  });
});

describe("admin verify2FA", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when fields missing", async () => {
    const req = createReq({ body: { email: "a@b.com" } });
    const res = createMockResponse();
    await verify2FA(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 for invalid code", async () => {
    mockAdminService.verify2FACode.mockResolvedValue(false);
    const req = createReq({ body: { email: "a@b.com", code: "000000" } });
    const res = createMockResponse();
    await verify2FA(req as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns token on valid code", async () => {
    mockAdminService.verify2FACode.mockResolvedValue(true);
    mockAdminService.generateToken.mockReturnValue("jwt-token");
    const req = createReq({ body: { email: "admin@cuttr.com", code: "123456" } });
    const res = createMockResponse();
    await verify2FA(req as any, res);
    expect(res.json).toHaveBeenCalledWith({ token: "jwt-token", email: "admin@cuttr.com" });
  });
});

describe("admin resend2FA", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for invalid credentials", async () => {
    mockAdminService.validateCredentials.mockReturnValue(false);
    const req = createReq({ body: { email: "a@b.com", password: "wrong" } });
    const res = createMockResponse();
    await resend2FA(req as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("resends code on valid credentials", async () => {
    mockAdminService.validateCredentials.mockReturnValue(true);
    mockAdminService.send2FACode.mockResolvedValue(undefined);
    const req = createReq({ body: { email: "a@b.com", password: "correct" } });
    const res = createMockResponse();
    await resend2FA(req as any, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("New verification code") })
    );
  });
});

describe("admin getAllTeams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns teams with pagination", async () => {
    const result = { teams: [{ id: 1 }], pagination: { total: 1, limit: 50, offset: 0, hasMore: false } };
    mockAdminService.getAllTeams.mockResolvedValue(result);
    const req = createReq({ query: {} });
    const res = createMockResponse();
    await getAllTeams(req as any, res);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it("passes search and pagination params", async () => {
    mockAdminService.getAllTeams.mockResolvedValue({ teams: [] });
    const req = createReq({ query: { search: "acme", limit: "10", offset: "20" } });
    const res = createMockResponse();
    await getAllTeams(req as any, res);
    expect(mockAdminService.getAllTeams).toHaveBeenCalledWith({
      search: "acme",
      limit: 10,
      offset: 20,
    });
  });
});

describe("admin getTeam", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "abc" } });
    const res = createMockResponse();
    await getTeam(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when team not found", async () => {
    mockAdminService.getTeamById.mockResolvedValue(undefined);
    const req = createReq({ params: { teamId: "999" } });
    const res = createMockResponse();
    await getTeam(req as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns team on success", async () => {
    mockAdminService.getTeamById.mockResolvedValue({ id: 1, name: "Acme" });
    const req = createReq({ params: { teamId: "1" } });
    const res = createMockResponse();
    await getTeam(req as any, res);
    expect(res.json).toHaveBeenCalledWith({ team: { id: 1, name: "Acme" } });
  });
});

describe("admin setupEnterprise", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when required fields missing", async () => {
    const req = createReq({ body: { teamId: 1 } });
    const res = createMockResponse();
    await setupEnterprise(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns checkout URL on success", async () => {
    mockAdminService.setupEnterprise.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com/session",
      priceId: "price_123",
    });
    const req = createReq({
      body: { teamId: "1", clipLimit: "500", monthlyPrice: "99.99", customerEmail: "a@b.com" },
    });
    const res = createMockResponse();
    await setupEnterprise(req as any, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ checkoutUrl: "https://checkout.stripe.com/session" })
    );
  });
});

describe("admin changePlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when required fields missing", async () => {
    const req = createReq({ body: { teamId: 1 } });
    const res = createMockResponse();
    await changePlan(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for non-enterprise plan", async () => {
    const req = createReq({ body: { teamId: 1, newPlan: "studio" } });
    const res = createMockResponse();
    await changePlan(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when enterprise fields missing", async () => {
    const req = createReq({ body: { teamId: 1, newPlan: "enterprise" } });
    const res = createMockResponse();
    await changePlan(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns success for enterprise plan change", async () => {
    mockAdminService.changePlanToEnterprise.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com",
      priceId: "price_123",
      hasPreviousSubscription: true,
    });
    const req = createReq({
      body: {
        teamId: "1",
        newPlan: "enterprise",
        clipLimit: "500",
        monthlyPrice: "99.99",
        customerEmail: "a@b.com",
      },
    });
    const res = createMockResponse();
    await changePlan(req as any, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ hasPreviousSubscription: true })
    );
  });
});

describe("admin getAllReferrals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns referrals", async () => {
    mockReferralService.getAllReferralsAdmin.mockResolvedValue([{ id: 1 }]);
    const req = createReq();
    const res = createMockResponse();
    await getAllReferrals(req as any, res);
    expect(res.json).toHaveBeenCalledWith({ referrals: [{ id: 1 }] });
  });
});

describe("admin setReferralReward", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when referralId missing", async () => {
    const req = createReq({ body: {} });
    const res = createMockResponse();
    await setReferralReward(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when referral not found", async () => {
    mockReferralService.setReferralReward.mockResolvedValue(false);
    const req = createReq({ body: { referralId: "999" } });
    const res = createMockResponse();
    await setReferralReward(req as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns success when reward set", async () => {
    mockReferralService.setReferralReward.mockResolvedValue(true);
    const req = createReq({ body: { referralId: "1", bonusClips: "10", percentOff: "15" } });
    const res = createMockResponse();
    await setReferralReward(req as any, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
