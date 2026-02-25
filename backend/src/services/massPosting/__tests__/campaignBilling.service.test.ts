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

import { campaignBillingService } from "../campaignBilling.service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeWallet = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  campaign_id: 10,
  team_id: 5,
  balance_cents: 500,
  total_deposited_cents: 500,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeTopUp = (overrides: Record<string, unknown> = {}) => ({
  id: 100,
  campaign_id: 10,
  team_id: 5,
  amount_cents: 1000,
  stripe_payment_intent_id: "pi_test_001",
  created_at: new Date(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// getWallet
// ---------------------------------------------------------------------------

describe("CampaignBillingService.getWallet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the wallet when found", async () => {
    const wallet = makeWallet();
    mockDb.select.mockReturnValue(createDrizzleChain([wallet]));

    const result = await campaignBillingService.getWallet(10);

    expect(result).toEqual(wallet);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it("returns null when wallet does not exist", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await campaignBillingService.getWallet(99);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getOrCreateWallet
// ---------------------------------------------------------------------------

describe("CampaignBillingService.getOrCreateWallet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing wallet without inserting", async () => {
    const wallet = makeWallet();
    // getWallet -> select
    mockDb.select.mockReturnValue(createDrizzleChain([wallet]));

    const result = await campaignBillingService.getOrCreateWallet(10, 5);

    expect(result).toEqual(wallet);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("creates and returns a new wallet when none exists", async () => {
    const newWallet = makeWallet({ id: 2, balance_cents: 0 });
    // getWallet returns nothing → insert creates one
    mockDb.select.mockReturnValue(createDrizzleChain([]));
    mockDb.insert.mockReturnValue(createDrizzleChain([newWallet]));

    const result = await campaignBillingService.getOrCreateWallet(10, 5);

    expect(result).toEqual(newWallet);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// topUp
// ---------------------------------------------------------------------------

describe("CampaignBillingService.topUp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("credits balance and returns updated balance when PI is new", async () => {
    const existingWallet = makeWallet({ balance_cents: 0 });
    const updatedWallet = makeWallet({ balance_cents: 1000 });

    // Call order inside topUp:
    //   1. select: check idempotency (no existing top-up)
    //   2. select: getOrCreateWallet -> getWallet (wallet already exists)
    //   3. insert: campaignWalletTopUps record
    //   4. update: campaignWallets balance → returns updatedWallet
    //   5. select: checkPaymentGate -> getWallet (updated wallet with balance)
    //   6. update: campaigns.payment_ready
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))           // idempotency check
      .mockReturnValueOnce(createDrizzleChain([existingWallet])) // getOrCreateWallet
      .mockReturnValueOnce(createDrizzleChain([updatedWallet])); // checkPaymentGate

    mockDb.insert.mockReturnValue(createDrizzleChain([]));
    mockDb.update.mockReturnValue(createDrizzleChain([updatedWallet]));

    const result = await campaignBillingService.topUp(10, 5, 1000, "pi_test_001");

    expect(result).toEqual({ balanceCents: 1000 });
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb.update).toHaveBeenCalledTimes(2); // wallet balance + payment_ready
  });

  it("is idempotent: skips insert and returns current balance when PI already credited", async () => {
    const existingTopUp = makeTopUp();
    const wallet = makeWallet({ balance_cents: 1000 });

    // Call order inside topUp (early-return branch):
    //   1. select: check idempotency (top-up found → short-circuit)
    //   2. select: getOrCreateWallet -> getWallet
    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([existingTopUp])) // idempotency hit
      .mockReturnValueOnce(createDrizzleChain([wallet]));       // getOrCreateWallet

    const result = await campaignBillingService.topUp(10, 5, 1000, "pi_test_001");

    expect(result).toEqual({ balanceCents: 1000 });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("calls checkPaymentGate after crediting so campaign payment_ready is updated", async () => {
    const walletBefore = makeWallet({ balance_cents: 0 });
    const walletAfter = makeWallet({ balance_cents: 500 });

    mockDb.select
      .mockReturnValueOnce(createDrizzleChain([]))            // idempotency
      .mockReturnValueOnce(createDrizzleChain([walletBefore])) // getOrCreateWallet
      .mockReturnValueOnce(createDrizzleChain([walletAfter])); // checkPaymentGate

    mockDb.insert.mockReturnValue(createDrizzleChain([]));
    mockDb.update.mockReturnValue(createDrizzleChain([walletAfter]));

    await campaignBillingService.topUp(10, 5, 500, "pi_new");

    // Two update calls: one for the wallet balance, one for campaigns.payment_ready
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// isTopUpCredited
// ---------------------------------------------------------------------------

describe("CampaignBillingService.isTopUpCredited", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when a top-up record exists for the given PI", async () => {
    const topUp = makeTopUp();
    mockDb.select.mockReturnValue(createDrizzleChain([topUp]));

    const result = await campaignBillingService.isTopUpCredited(10, "pi_test_001");

    expect(result).toBe(true);
  });

  it("returns false when no top-up record matches", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));

    const result = await campaignBillingService.isTopUpCredited(10, "pi_ghost");

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkPaymentGate
// ---------------------------------------------------------------------------

describe("CampaignBillingService.checkPaymentGate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true and marks campaign payment_ready when balance > 0", async () => {
    const wallet = makeWallet({ balance_cents: 250 });
    mockDb.select.mockReturnValue(createDrizzleChain([wallet]));
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    const result = await campaignBillingService.checkPaymentGate(10);

    expect(result).toBe(true);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("returns false and marks campaign not payment_ready when balance is 0", async () => {
    const wallet = makeWallet({ balance_cents: 0 });
    mockDb.select.mockReturnValue(createDrizzleChain([wallet]));
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    const result = await campaignBillingService.checkPaymentGate(10);

    expect(result).toBe(false);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it("returns false and updates campaign when wallet does not exist", async () => {
    mockDb.select.mockReturnValue(createDrizzleChain([]));
    mockDb.update.mockReturnValue(createDrizzleChain([]));

    const result = await campaignBillingService.checkPaymentGate(10);

    expect(result).toBe(false);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });
});
