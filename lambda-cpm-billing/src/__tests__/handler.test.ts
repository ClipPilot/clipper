import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──

const { mockDb, mockTx, mockStripeCreate, mockResendSend } = vi.hoisted(() => {
  const createChain = (result: any[] = []) => {
    const chain: Record<string, any> = {};
    for (const m of ["from", "where", "limit", "orderBy", "innerJoin", "set", "values", "returning"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.then = (resolve: Function) => resolve(result);
    return chain;
  };

  const mockTx = {
    select: vi.fn(() => createChain([])),
    insert: vi.fn(() => createChain([])),
    update: vi.fn(() => createChain([])),
  };

  return {
    mockDb: {
      select: vi.fn(() => createChain([])),
      insert: vi.fn(() => createChain([])),
      update: vi.fn(() => createChain([])),
      execute: vi.fn().mockResolvedValue([{ acquired: true }]),
      transaction: vi.fn(async (fn: Function) => fn(mockTx)),
      createChain,
    },
    mockTx,
    mockStripeCreate: vi.fn(),
    mockResendSend: vi.fn().mockResolvedValue({ data: { id: "msg-1" }, error: null }),
  };
});

// ── Module mocks ──

vi.mock("pg", () => ({ Pool: class MockPool {} }));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => mockDb }));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  sql: Object.assign(vi.fn(), { join: vi.fn() }),
  inArray: vi.fn((...args: any[]) => args),
  gt: vi.fn((...args: any[]) => args),
  gte: vi.fn((...args: any[]) => args),
  isNotNull: vi.fn((...args: any[]) => args),
  desc: vi.fn((...args: any[]) => args),
}));

vi.mock("stripe", () => ({
  default: class MockStripe {
    paymentIntents = { create: mockStripeCreate };
  },
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockResendSend };
  },
}));

vi.mock("@clipper/shared-email", () => ({
  campaignPausedEmail: vi.fn(() => "<html>paused</html>"),
}));

vi.mock("@clipper/shared-db", () => ({
  campaignDailyCharges: { id: "cdc.id", charge_date: "cdc.charge_date" },
  campaigns: { id: "c.id", team_id: "c.team_id", quoted_cpm: "c.quoted_cpm", status: "c.status", name: "c.name" },
  userPosts: { id: "up.id", mass_post_id: "up.mass_post_id", video_play_count: "up.vpc", video_view_count: "up.vvc", last_billed_views: "up.lbv", syncs_remaining: "up.sr", post_url: "up.post_url" },
  posts: { id: "p.id", campaign_id: "p.campaign_id" },
  campaignWallets: { campaign_id: "cw.campaign_id", balance_cents: "cw.bc", total_spent_cents: "cw.tsc" },
  teams: { id: "t.id", stripe_customer_id: "t.sci" },
  users: { id: "u.id", email: "u.email", first_name: "u.fn" },
  teamMembers: { user_id: "tm.uid", team_id: "tm.tid", role: "tm.role" },
}));

// ── Setup env ──

process.env.DATABASE_URL = "postgres://test";
process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.RESEND_API_KEY = "re_test_123";
process.env.FRONTEND_URL = "https://test.cuttr.com";

import { handler } from "../handler";

describe("CPM Billing Lambda", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips billing if charged within 20 hours", async () => {
    mockDb.select.mockReturnValueOnce(mockDb.createChain([{ id: 1 }]));

    const result = await handler({}, {} as any, () => {});
    const body = JSON.parse(result.body);

    expect(body.skipped).toBe(true);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("processes campaign and charges wallet when sufficient", async () => {
    // dedup
    mockDb.select.mockReturnValueOnce(mockDb.createChain([]));
    // active campaigns
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{ id: 10, team_id: 5, quoted_cpm: "2.00", status: "started" }])
    );
    // billable posts
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{
        user_post_id: 100,
        video_play_count: 5000,
        video_view_count: null,
        last_billed_views: 0,
        syncs_remaining: 20,
      }])
    );
    // wallet with enough balance
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{
        campaign_id: 10,
        balance_cents: 5000,
        total_spent_cents: 0,
        stripe_payment_method_id: "pm_test",
      }])
    );
    // wallet update (atomic debit success)
    mockDb.update.mockReturnValueOnce(mockDb.createChain([{ id: 1 }]));
    // transaction: insert charge record + batch update (uses mockTx)
    mockTx.insert.mockReturnValueOnce(mockDb.createChain([]));
    mockTx.update.mockReturnValueOnce(mockDb.createChain([]));

    const result = await handler({}, {} as any, () => {});
    const body = JSON.parse(result.body);

    expect(body.campaignsProcessed).toBe(1);
    expect(body.totalChargedCents).toBe(1000);
    expect(body.failures).toBe(0);
    expect(mockTx.insert).toHaveBeenCalledTimes(1);
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });

  it("splits charge into wallet + card when wallet is insufficient", async () => {
    // dedup
    mockDb.select.mockReturnValueOnce(mockDb.createChain([]));
    // active campaigns
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{ id: 10, team_id: 5, quoted_cpm: "2.00", status: "started" }])
    );
    // billable posts — 10k views = $20 charge
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{
        user_post_id: 100,
        video_play_count: 10000,
        video_view_count: null,
        last_billed_views: 0,
        syncs_remaining: 20,
      }])
    );
    // wallet with $5 (500 cents) — not enough for $20
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{
        campaign_id: 10,
        balance_cents: 500,
        total_spent_cents: 0,
        stripe_payment_method_id: "pm_test",
      }])
    );
    // atomic wallet debit fails (balance < amount)
    mockDb.update.mockReturnValueOnce(mockDb.createChain([]));
    // team lookup for Stripe
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{ stripe_customer_id: "cus_test" }])
    );
    // Stripe succeeds for card portion ($15)
    mockStripeCreate.mockResolvedValueOnce({ status: "succeeded", id: "pi_split" });
    // wallet drain
    mockDb.update.mockReturnValueOnce(mockDb.createChain([]));
    // transaction: insert wallet + card charge records + batch update (uses mockTx)
    mockTx.insert.mockReturnValueOnce(mockDb.createChain([]));
    mockTx.insert.mockReturnValueOnce(mockDb.createChain([]));
    mockTx.update.mockReturnValueOnce(mockDb.createChain([]));

    const result = await handler({}, {} as any, () => {});
    const body = JSON.parse(result.body);

    expect(body.totalChargedCents).toBe(2000);
    expect(body.failures).toBe(0);
    // Two charge records: wallet + card (inside transaction)
    expect(mockTx.insert).toHaveBeenCalledTimes(2);
    // Stripe charged for remainder ($15 = 1500 cents)
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1500 })
    );
  });

  it("does NOT drain wallet if card charge fails", async () => {
    // dedup
    mockDb.select.mockReturnValueOnce(mockDb.createChain([]));
    // active campaigns
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{ id: 10, team_id: 5, quoted_cpm: "2.00", status: "started" }])
    );
    // billable posts — $20 charge
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{
        user_post_id: 100,
        video_play_count: 10000,
        video_view_count: null,
        last_billed_views: 0,
        syncs_remaining: 20,
      }])
    );
    // wallet with $5
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{
        campaign_id: 10,
        balance_cents: 500,
        total_spent_cents: 0,
        stripe_payment_method_id: "pm_test",
      }])
    );
    // atomic wallet debit fails (balance < amount)
    mockDb.update.mockReturnValueOnce(mockDb.createChain([]));
    // team lookup
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{ stripe_customer_id: "cus_test" }])
    );
    // Stripe FAILS
    mockStripeCreate.mockRejectedValueOnce(new Error("card_declined"));
    // insert failed charge record
    mockDb.insert.mockReturnValueOnce(mockDb.createChain([]));
    // endCampaignAndStopTracking: campaign name
    mockDb.select.mockReturnValueOnce(mockDb.createChain([{ name: "Test" }]));
    // pause campaign
    mockDb.update.mockReturnValueOnce(mockDb.createChain([]));
    // linked post IDs
    mockDb.select.mockReturnValueOnce(mockDb.createChain([{ id: 100 }]));
    // zero syncs
    mockDb.update.mockReturnValueOnce(mockDb.createChain([]));
    // email: team name
    mockDb.select.mockReturnValueOnce(mockDb.createChain([{ name: "Team" }]));
    // email: owner
    mockDb.select.mockReturnValueOnce(mockDb.createChain([{ email: "o@t.com", firstName: "O" }]));

    const result = await handler({}, {} as any, () => {});
    const body = JSON.parse(result.body);

    expect(body.failures).toBe(1);
    // Wallet should NOT have been drained (only 1 insert for the failed record)
    // No wallet update calls for draining since card failed first
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("skips campaigns with no billable posts", async () => {
    mockDb.select
      .mockReturnValueOnce(mockDb.createChain([])) // dedup
      .mockReturnValueOnce(mockDb.createChain([{ id: 10, team_id: 5, quoted_cpm: "2.00", status: "started" }]))
      .mockReturnValueOnce(mockDb.createChain([])); // no billable posts

    const result = await handler({}, {} as any, () => {});
    const body = JSON.parse(result.body);

    expect(body.totalChargedCents).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("never bills negative view deltas", async () => {
    mockDb.select
      .mockReturnValueOnce(mockDb.createChain([])) // dedup
      .mockReturnValueOnce(mockDb.createChain([{ id: 10, team_id: 5, quoted_cpm: "2.00", status: "started" }]))
      .mockReturnValueOnce(mockDb.createChain([{
        user_post_id: 100,
        video_play_count: 300,
        video_view_count: null,
        last_billed_views: 500,
        syncs_remaining: 10,
      }]));

    const result = await handler({}, {} as any, () => {});
    const body = JSON.parse(result.body);

    expect(body.totalChargedCents).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("sends emails when campaign is paused due to payment failure", async () => {
    mockDb.select.mockReturnValueOnce(mockDb.createChain([])); // dedup
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{ id: 10, team_id: 5, quoted_cpm: "2.00", status: "started" }])
    );
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{
        user_post_id: 100,
        video_play_count: 5000,
        video_view_count: null,
        last_billed_views: 0,
        syncs_remaining: 20,
      }])
    );
    // wallet — empty with no card
    mockDb.select.mockReturnValueOnce(
      mockDb.createChain([{
        campaign_id: 10,
        balance_cents: 0,
        total_spent_cents: 0,
        stripe_payment_method_id: null,
      }])
    );
    // atomic debit fails
    mockDb.update.mockReturnValueOnce(mockDb.createChain([]));
    // insert failed charge record
    mockDb.insert.mockReturnValueOnce(mockDb.createChain([]));
    // endCampaignAndStopTracking: campaign name
    mockDb.select.mockReturnValueOnce(mockDb.createChain([{ name: "Test Campaign" }]));
    // pause campaign
    mockDb.update.mockReturnValueOnce(mockDb.createChain([]));
    // linked post IDs
    mockDb.select.mockReturnValueOnce(mockDb.createChain([{ id: 100 }]));
    // zero syncs
    mockDb.update.mockReturnValueOnce(mockDb.createChain([]));
    // email: team name
    mockDb.select.mockReturnValueOnce(mockDb.createChain([{ name: "Team Test" }]));
    // email: owner
    mockDb.select.mockReturnValueOnce(mockDb.createChain([{ email: "owner@test.com", firstName: "Owner" }]));

    const result = await handler({}, {} as any, () => {});
    const body = JSON.parse(result.body);

    expect(body.failures).toBe(1);
    expect(mockResendSend).toHaveBeenCalledTimes(2);
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({ to: ["owner@test.com"] }));
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({ to: ["contact@cuttr.com"] }));
  });

  it("handles no active campaigns gracefully", async () => {
    mockDb.select
      .mockReturnValueOnce(mockDb.createChain([])) // dedup
      .mockReturnValueOnce(mockDb.createChain([])); // no campaigns

    const result = await handler({}, {} as any, () => {});
    const body = JSON.parse(result.body);

    expect(body.campaignsProcessed).toBe(0);
    expect(body.totalChargedCents).toBe(0);
    expect(body.failures).toBe(0);
  });
});
