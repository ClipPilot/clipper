import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../test/helpers/db.helper";

const { mockDb, mockEmailNotiService, mockApplyReferralDiscount } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockEmailNotiService: {
    sendReferralApplied: vi.fn(),
    sendReferralSuccess: vi.fn(),
    sendReferralConverted: vi.fn(),
    sendReferralRewardSet: vi.fn(),
  },
  mockApplyReferralDiscount: vi.fn(),
}));

vi.mock("../../db", () => ({ db: mockDb }));
vi.mock("../emailNoti.service", () => ({
  emailNotiService: mockEmailNotiService,
}));
vi.mock("../stripe.service", () => ({
  applyReferralDiscount: mockApplyReferralDiscount,
}));

import { referralService } from "../referral.service";

describe("referralService.generateCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates a code with CUTTR- prefix", async () => {
    mockDb.insert.mockReturnValue(
      createDrizzleChain([{ id: 1, code: "CUTTR-ABCD1234" }])
    );

    const result = await referralService.generateCode(100);

    expect(result.code).toMatch(/^CUTTR-/);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});

describe("referralService.getCodeByTeamId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the code when found", async () => {
    const code = { id: 1, code: "CUTTR-XYZ", created_by_team_id: 100 };
    mockDb.select.mockReturnValue(createDrizzleChain([code]));

    const result = await referralService.getCodeByTeamId(100);
    expect(result).toEqual(code);
  });

  it("returns null when no code exists", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await referralService.getCodeByTeamId(100);
    expect(result).toBeNull();
  });
});

describe("referralService.getCodeByCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the referral code record", async () => {
    const code = { id: 1, code: "CUTTR-ABC", created_by_team_id: 50 };
    mockDb.select.mockReturnValue(createDrizzleChain([code]));

    const result = await referralService.getCodeByCode("cuttr-abc");
    expect(result).toEqual(code);
  });

  it("returns null when not found", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await referralService.getCodeByCode("NOPE");
    expect(result).toBeNull();
  });
});

describe("referralService.applyReferralCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false when code doesn't exist", async () => {
    // getCodeByCode returns null
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await referralService.applyReferralCode(200, "INVALID");
    expect(result).toBe(false);
  });

  it("returns false when referring own team", async () => {
    // getCodeByCode returns a code owned by team 200
    mockDb.select.mockReturnValue(
      createDrizzleChain([{ id: 1, code: "CUTTR-X", created_by_team_id: 200 }])
    );

    const result = await referralService.applyReferralCode(200, "CUTTR-X");
    expect(result).toBe(false);
  });

  it("returns false when team already has a referral", async () => {
    // getCodeByCode returns valid code
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([{ id: 1, code: "CUTTR-X", created_by_team_id: 100 }]))
      // existing referral found
      .mockReturnValueOnce(createDrizzleChain([{ id: 5, referred_team_id: 200 }]));

    const result = await referralService.applyReferralCode(200, "CUTTR-X");
    expect(result).toBe(false);
  });

  it("creates referral and returns true on success", async () => {
    // getCodeByCode returns valid code
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([{ id: 1, code: "CUTTR-X", created_by_team_id: 100 }]))
      // no existing referral
      .mockReturnValueOnce(createDrizzleChain([]))
      // getTeamWithOwner for referrer team
      .mockReturnValueOnce(createDrizzleChain([{ id: 100, name: "Referrer Team" }]))
      .mockReturnValueOnce(createDrizzleChain([{ email: "owner@test.com", firstName: "Owner" }]))
      // getTeamWithOwner for referred team
      .mockReturnValueOnce(createDrizzleChain([{ id: 200, name: "Referred Team" }]))
      .mockReturnValueOnce(createDrizzleChain([{ email: "new@test.com", firstName: "New" }]));

    mockDb.insert.mockReturnValue(createDrizzleChain([]));
    mockEmailNotiService.sendReferralApplied.mockResolvedValue(undefined);

    const result = await referralService.applyReferralCode(200, "CUTTR-X");

    expect(result).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockEmailNotiService.sendReferralApplied).toHaveBeenCalled();
  });
});

describe("referralService.getReferralStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns zeros when no referral code exists", async () => {
    // getReferralsByTeam -> getCodeByTeamId returns null
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await referralService.getReferralStats(100);

    expect(result).toEqual({
      totalReferrals: 0,
      activeReferrals: 0,
      pendingReferrals: 0,
      totalBonusClips: 0,
      totalPercentOff: 0,
    });
  });
});

describe("referralService.getAccumulatedPercentOff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 0 when no code exists", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await referralService.getAccumulatedPercentOff(100);
    expect(result).toBe(0);
  });

  it("caps at 100%", async () => {
    mockDb.select
      // getCodeByTeamId returns a code
      .mockReturnValueOnce(createDrizzleChain([{ id: 1 }]))
      // active referrals with high percent_off
      .mockReturnValueOnce(
        createDrizzleChain([
          { percentOff: "60" },
          { percentOff: "50" },
        ])
      );

    const result = await referralService.getAccumulatedPercentOff(100);
    expect(result).toBe(100);
  });
});

describe("referralService.getPendingRewardsForTeam", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns zeros when no code exists", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await referralService.getPendingRewardsForTeam(100);
    expect(result).toEqual({ bonusClips: 0, percentOff: 0 });
  });

  it("sums bonus clips and percent off from pending rewards", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([{ id: 1 }]))
      .mockReturnValueOnce(
        createDrizzleChain([
          { bonusClips: 10, percentOff: "5" },
          { bonusClips: 20, percentOff: "10" },
        ])
      );

    const result = await referralService.getPendingRewardsForTeam(100);
    expect(result).toEqual({ bonusClips: 30, percentOff: 15 });
  });

  it("caps percentOff at 100", async () => {
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([{ id: 1 }]))
      .mockReturnValueOnce(
        createDrizzleChain([
          { bonusClips: 0, percentOff: "80" },
          { bonusClips: 0, percentOff: "30" },
        ])
      );

    const result = await referralService.getPendingRewardsForTeam(100);
    expect(result.percentOff).toBe(100);
  });
});
