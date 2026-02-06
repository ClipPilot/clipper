import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { AuthRequest } from "../../middleware/auth.middleware";

const { mockReferralService } = vi.hoisted(() => ({
  mockReferralService: {
    getCodeByTeamId: vi.fn(),
    generateCode: vi.fn(),
    applyReferralCode: vi.fn(),
    getReferralsByTeam: vi.fn(),
    getReferralStats: vi.fn(),
    getCodeByCode: vi.fn(),
  },
}));

vi.mock("../../services/referral.service", () => ({
  referralService: mockReferralService,
}));

import {
  generateCodeController,
  getCodeController,
  applyCodeController,
  getReferralsController,
  getStatsController,
  validateCodeController,
} from "../referral.controller";

function createReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as AuthRequest;
}

describe("generateCodeController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "abc" } });
    const res = createMockResponse();
    await generateCodeController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns existing code if one exists", async () => {
    mockReferralService.getCodeByTeamId.mockResolvedValue({ code: "CUTTR-XYZ" });
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await generateCodeController(req, res);
    expect(res.json).toHaveBeenCalledWith({ code: { code: "CUTTR-XYZ" } });
    expect(mockReferralService.generateCode).not.toHaveBeenCalled();
  });

  it("generates a new code when none exists", async () => {
    mockReferralService.getCodeByTeamId.mockResolvedValue(null);
    mockReferralService.generateCode.mockResolvedValue({ id: 1, code: "CUTTR-NEW" });
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await generateCodeController(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ code: { id: 1, code: "CUTTR-NEW" } });
  });
});

describe("getCodeController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "x" } });
    const res = createMockResponse();
    await getCodeController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns the code", async () => {
    mockReferralService.getCodeByTeamId.mockResolvedValue({ code: "CUTTR-A" });
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await getCodeController(req, res);
    expect(res.json).toHaveBeenCalledWith({ code: { code: "CUTTR-A" } });
  });
});

describe("applyCodeController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when code is missing", async () => {
    const req = createReq({ params: { teamId: "5" }, body: {} });
    const res = createMockResponse();
    await applyCodeController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when referral fails", async () => {
    mockReferralService.applyReferralCode.mockResolvedValue(false);
    const req = createReq({ params: { teamId: "5" }, body: { code: "BAD" } });
    const res = createMockResponse();
    await applyCodeController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns success when code applied", async () => {
    mockReferralService.applyReferralCode.mockResolvedValue(true);
    const req = createReq({ params: { teamId: "5" }, body: { code: "CUTTR-X" } });
    const res = createMockResponse();
    await applyCodeController(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe("getReferralsController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid teamId", async () => {
    const req = createReq({ params: { teamId: "x" } });
    const res = createMockResponse();
    await getReferralsController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns referral data", async () => {
    const data = { code: { code: "C" }, referrals: [] };
    mockReferralService.getReferralsByTeam.mockResolvedValue(data);
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await getReferralsController(req, res);
    expect(res.json).toHaveBeenCalledWith(data);
  });
});

describe("getStatsController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns stats", async () => {
    const stats = { totalReferrals: 3, activeReferrals: 1 };
    mockReferralService.getReferralStats.mockResolvedValue(stats);
    const req = createReq({ params: { teamId: "5" } });
    const res = createMockResponse();
    await getStatsController(req, res);
    expect(res.json).toHaveBeenCalledWith(stats);
  });
});

describe("validateCodeController", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when code is missing", async () => {
    const req = createReq({ params: {} });
    const res = createMockResponse();
    await validateCodeController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns valid=false when code not found", async () => {
    mockReferralService.getCodeByCode.mockResolvedValue(null);
    const req = createReq({ params: { code: "NOPE" } });
    const res = createMockResponse();
    await validateCodeController(req, res);
    expect(res.json).toHaveBeenCalledWith({ valid: false });
  });

  it("returns valid=true when code found", async () => {
    mockReferralService.getCodeByCode.mockResolvedValue({ code: "CUTTR-X" });
    const req = createReq({ params: { code: "CUTTR-X" } });
    const res = createMockResponse();
    await validateCodeController(req, res);
    expect(res.json).toHaveBeenCalledWith({ valid: true, code: "CUTTR-X" });
  });
});
