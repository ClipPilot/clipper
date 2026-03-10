import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../../test/helpers/db.helper";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../../db", () => ({ db: mockDb }));

import { cpmBillingService } from "../cpmBilling.service";

const makeDailyCharge = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  campaign_id: 10,
  team_id: 5,
  charge_date: new Date("2026-03-01"),
  total_views_delta: 5000,
  cpm_rate: "2.00",
  charge_cents: 1000,
  source: "wallet" as const,
  status: "charged" as const,
  stripe_payment_intent_id: null,
  failure_reason: null,
  post_breakdown: [
    { user_post_id: 1, previous_views: 0, current_views: 5000, delta_views: 5000, charge_cents: 1000 },
  ],
  created_at: new Date("2026-03-01"),
  ...overrides,
});

describe("CpmBillingService.getBillingBreakdown", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns summary and daily charges for a campaign", async () => {
    const campaign = { quoted_cpm: "2.00", status: "started" };
    const charges = [
      makeDailyCharge({ id: 2, charge_cents: 800, total_views_delta: 4000, source: "card" }),
      makeDailyCharge({ id: 1, charge_cents: 1000, total_views_delta: 5000, source: "wallet" }),
    ];

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([campaign]))
      .mockReturnValueOnce(createDrizzleChain(charges))
      .mockReturnValueOnce(createDrizzleChain([{ id: 1, post_url: "https://tiktok.com/post1" }]));

    const result = await cpmBillingService.getBillingBreakdown(10, 5);

    expect(result.summary).toEqual({
      totalChargedCents: 1800,
      totalViews: 9000,
      walletSpentCents: 1000,
      cardChargedCents: 800,
      cpmRate: "2.00",
      daysTracked: 2,
    });
    expect(result.dailyCharges).toHaveLength(2);
    expect(result.dailyCharges[0].id).toBe(2);
  });

  it("throws when campaign not found", async () => {
    mockDb.select.mockReturnValueOnce(createDrizzleChain([]));

    await expect(cpmBillingService.getBillingBreakdown(99, 5)).rejects.toThrow("Campaign not found");
  });

  it("excludes failed charges from summary totals", async () => {
    const campaign = { quoted_cpm: "3.00", status: "started" };
    const charges = [
      makeDailyCharge({ id: 1, charge_cents: 1500, total_views_delta: 5000, status: "charged", source: "wallet" }),
      makeDailyCharge({ id: 2, charge_cents: 900, total_views_delta: 3000, status: "failed", source: null }),
    ];

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([campaign]))
      .mockReturnValueOnce(createDrizzleChain(charges))
      .mockReturnValueOnce(createDrizzleChain([{ id: 1, post_url: null }]));

    const result = await cpmBillingService.getBillingBreakdown(10, 5);

    expect(result.summary.totalChargedCents).toBe(1500);
    expect(result.summary.totalViews).toBe(5000);
    expect(result.summary.daysTracked).toBe(2);
  });

  it("returns zeroed summary when no charges exist", async () => {
    const campaign = { quoted_cpm: "2.00", status: "started" };

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([campaign]))
      .mockReturnValueOnce(createDrizzleChain([]));

    const result = await cpmBillingService.getBillingBreakdown(10, 5);

    expect(result.summary.totalChargedCents).toBe(0);
    expect(result.summary.totalViews).toBe(0);
    expect(result.summary.walletSpentCents).toBe(0);
    expect(result.summary.cardChargedCents).toBe(0);
    expect(result.summary.daysTracked).toBe(0);
    expect(result.dailyCharges).toHaveLength(0);
  });

  it("maps daily charge fields correctly", async () => {
    const campaign = { quoted_cpm: "2.50", status: "started" };
    const charge = makeDailyCharge({
      source: "card",
      stripe_payment_intent_id: "pi_abc",
      failure_reason: null,
    });

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([campaign]))
      .mockReturnValueOnce(createDrizzleChain([charge]))
      .mockReturnValueOnce(createDrizzleChain([{ id: 1, post_url: "https://tiktok.com/post1" }]));

    const result = await cpmBillingService.getBillingBreakdown(10, 5);
    const mapped = result.dailyCharges[0];

    expect(mapped.chargeDate).toEqual(charge.charge_date);
    expect(mapped.totalViewsDelta).toBe(charge.total_views_delta);
    expect(mapped.cpmRate).toBe("2.00");
    expect(mapped.chargeCents).toBe(1000);
    expect(mapped.source).toBe("card");
    expect(mapped.status).toBe("charged");
    expect(mapped.postBreakdown).toEqual(
      (charge.post_breakdown as any[]).map((e) => ({ ...e, post_url: "https://tiktok.com/post1" }))
    );
  });
});
