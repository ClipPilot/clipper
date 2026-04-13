import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDrizzleChain } from "../../../test/helpers/db.helper";

const { mockDb, mockStripe, mockEmailNotiService, mockReferralService } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
  mockStripe: {
    customers: { retrieve: vi.fn(), create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
    coupons: { retrieve: vi.fn(), create: vi.fn(), del: vi.fn() },
  },
  mockEmailNotiService: {
    sendSubscriptionWelcome: vi.fn(),
    sendSubscriptionCancelled: vi.fn(),
    sendSubscriptionRenewal: vi.fn(),
    sendPaymentFailed: vi.fn(),
  },
  mockReferralService: {
    activateReferral: vi.fn(),
    applyBonusClipsOnRenewal: vi.fn(),
    getAccumulatedPercentOff: vi.fn(),
  },
}));

vi.mock("../../db", () => ({ db: mockDb }));
vi.mock("../../config/stripe.config", () => ({
  stripe: mockStripe,
  STRIPE_PRICES: {},
  getPlanFromPriceId: (priceId: string) => {
    if (priceId === "price_studio") return "studio";
    if (priceId === "price_scale") return "scale";
    return "free";
  },
  getClipsLimitForPlan: (plan: string) => {
    if (plan === "studio") return 400;
    if (plan === "scale") return 1000;
    if (plan === "enterprise") return -1;
    return 15;
  },
  isAddonPrice: (priceId: string) => priceId.startsWith("price_addon"),
  getAddonClips: (priceId: string) => {
    if (priceId === "price_addon_100") return 100;
    return 0;
  },
}));
vi.mock("../emailNoti.service", () => ({ emailNotiService: mockEmailNotiService }));
vi.mock("../referral.service", () => ({ referralService: mockReferralService }));
vi.mock("../virality/virality.service", () => ({ viralityService: { pauseAllAccountsForTeam: vi.fn() } }));
vi.mock("../virality/userPerformance.service", () => ({ userPerformanceService: { pauseAllAccountsForTeam: vi.fn() } }));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));
vi.mock("@clipper/shared-db/src/schema", () => ({
  teams: "teams",
  subscriptions: "subscriptions",
  usageStats: "usageStats",
  teamMembers: "teamMembers",
  users: "users",
  competitorAccounts: "competitorAccounts",
  competitorPosts: "competitorPosts",
  viralityGroups: "viralityGroups",
  viralitySettings: "viralitySettings",
  viralityAlertLogs: "viralityAlertLogs",
  userAccounts: "userAccounts",
  userPosts: "userPosts",
  posts: "posts",
  campaigns: "campaigns",
  apiWalletTopUps: "apiWalletTopUps",
}));
vi.mock("../virality/virality.service", () => ({
  viralityService: {
    deactivateExcessAccounts: vi.fn().mockResolvedValue(0),
    reactivateAllAccounts: vi.fn().mockResolvedValue(0),
  },
}));
vi.mock("../../utils/plans", () => ({
  isAnalyticsPlan: vi.fn().mockReturnValue(false),
  isMainPlatformPlan: vi.fn().mockReturnValue(false),
  getViralityAccountLimit: vi.fn().mockReturnValue(-1),
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  not: vi.fn((arg: any) => arg),
  sql: vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({ strings, values })),
}));

import { stripeService } from "../stripe.service";

describe("StripeService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getOrCreateCustomer", () => {
    it("returns existing customer when valid", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, stripe_customer_id: "cus_123" }]));
      mockStripe.customers.retrieve.mockResolvedValue({ id: "cus_123" });

      const result = await stripeService.getOrCreateCustomer(1, "a@b.com");
      expect(result).toBe("cus_123");
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it("creates new customer when existing is resource_missing", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, stripe_customer_id: "cus_old" }]));
      mockStripe.customers.retrieve.mockRejectedValue({ code: "resource_missing" });
      mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      mockStripe.customers.create.mockResolvedValue({ id: "cus_new" });

      const result = await stripeService.getOrCreateCustomer(1, "a@b.com");
      expect(result).toBe("cus_new");
    });

    it("creates new customer when team has no customer ID", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, stripe_customer_id: null }]));
      mockStripe.customers.create.mockResolvedValue({ id: "cus_brand_new" });
      mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });

      const result = await stripeService.getOrCreateCustomer(1, "a@b.com");
      expect(result).toBe("cus_brand_new");
    });
  });

  describe("createCheckoutSession", () => {
    it("creates subscription checkout for non-addon price", async () => {
      // Mock getOrCreateCustomer chain
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, stripe_customer_id: "cus_1" }]));
      mockStripe.customers.retrieve.mockResolvedValue({ id: "cus_1" });
      mockStripe.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.com/sub" });

      const result = await stripeService.createCheckoutSession(
        1, "price_studio", "a@b.com", "https://app/success", "https://app/cancel",
      );
      expect(result).toBe("https://checkout.stripe.com/sub");
      const call = mockStripe.checkout.sessions.create.mock.calls[0][0];
      expect(call.mode).toBe("subscription");
    });

    it("creates payment checkout for addon price", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, stripe_customer_id: "cus_1" }]));
      mockStripe.customers.retrieve.mockResolvedValue({ id: "cus_1" });
      mockStripe.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.com/addon" });

      const result = await stripeService.createCheckoutSession(
        1, "price_addon_100", "a@b.com", "https://app/success", "https://app/cancel",
      );
      expect(result).toBe("https://checkout.stripe.com/addon");
      const call = mockStripe.checkout.sessions.create.mock.calls[0][0];
      expect(call.mode).toBe("payment");
    });
  });

  describe("createPortalSession", () => {
    it("throws when team has no customer", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, stripe_customer_id: null }]));
      await expect(stripeService.createPortalSession(1, "https://app")).rejects.toThrow("No Stripe customer");
    });

    it("returns portal URL on success", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, stripe_customer_id: "cus_1" }]));
      mockStripe.customers.retrieve.mockResolvedValue({ id: "cus_1" });
      mockStripe.billingPortal.sessions.create.mockResolvedValue({ url: "https://billing.stripe.com/portal" });

      const result = await stripeService.createPortalSession(1, "https://app");
      expect(result).toBe("https://billing.stripe.com/portal");
    });
  });

  describe("getTeamSubscription", () => {
    it("returns subscription when found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, team_id: 1, plan: "studio" }]));
      const result = await stripeService.getTeamSubscription(1);
      expect(result).toEqual({ id: 1, team_id: 1, plan: "studio" });
    });

    it("returns null when not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      const result = await stripeService.getTeamSubscription(1);
      expect(result).toBeNull();
    });
  });

  describe("getTeamPlan", () => {
    it("returns team plan", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ id: 1, plan: "scale" }]));
      const result = await stripeService.getTeamPlan(1);
      expect(result).toBe("scale");
    });

    it("returns free when team not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      const result = await stripeService.getTeamPlan(1);
      expect(result).toBe("free");
    });
  });

  describe("handleCheckoutCompleted", () => {
    it("skips addon when payment not yet confirmed", async () => {
      await stripeService.handleCheckoutCompleted({
        mode: "payment",
        metadata: { type: "addon", teamId: "1", priceId: "price_addon_100" },
        payment_status: "unpaid",
      });
      // Should not touch DB
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("adds addon clips on paid addon checkout", async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ addon_clips_remaining: 150 }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      await stripeService.handleCheckoutCompleted({
        mode: "payment",
        metadata: { type: "addon", teamId: "1", priceId: "price_addon_100" },
        payment_status: "paid",
      });

      expect(mockDb.update).toHaveBeenCalled();
      const setArg = mockSet.mock.calls[0][0];
      // addon_clips_remaining is a sql template expression, not a plain number
      expect(setArg.addon_clips_remaining).toBeDefined();
      expect(setArg.updated_at).toBeInstanceOf(Date);
    });

    it("ignores non-addon one-time payments", async () => {
      await stripeService.handleCheckoutCompleted({
        mode: "payment",
        metadata: { type: "other" },
        payment_status: "paid",
      });
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionDeleted", () => {
    it("does nothing when subscription not found", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([]));
      await stripeService.handleSubscriptionDeleted({ id: "sub_missing" });
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("changePlan", () => {
    it("throws when no active subscription", async () => {
      mockDb.select.mockReturnValue(createDrizzleChain([{ status: "canceled" }]));
      await expect(stripeService.changePlan(1, "price_scale")).rejects.toThrow("No active subscription");
    });

    it("changes plan successfully", async () => {
      const periodEnd = new Date("2025-02-01");
      mockDb.select.mockReturnValue(
        createDrizzleChain([{
          stripe_subscription_id: "sub_1",
          status: "active",
          plan: "studio",
          current_period_end: periodEnd,
        }]),
      );
      mockStripe.subscriptions.retrieve.mockResolvedValue({ items: { data: [{ id: "si_1" }] } });
      mockStripe.subscriptions.update.mockResolvedValue({});

      const result = await stripeService.changePlan(1, "price_scale");
      expect(result.success).toBe(true);
      expect(result.newPlan).toBe("scale");
      expect(result.effectiveDate).toEqual(periodEnd);
    });
  });

  describe("applyReferralDiscountToSubscription", () => {
    it("creates coupon and applies to subscription", async () => {
      mockStripe.coupons.retrieve.mockRejectedValue(new Error("not found"));
      mockStripe.coupons.create.mockResolvedValue({ id: "referral_cus_1_10" });
      mockStripe.subscriptions.update.mockResolvedValue({});

      await stripeService.applyReferralDiscountToSubscription("cus_1", "sub_1", 10);
      expect(mockStripe.coupons.create).toHaveBeenCalledWith(
        expect.objectContaining({ percent_off: 10, duration: "forever" }),
      );
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_1", {
        discounts: [{ coupon: "referral_cus_1_10" }],
      });
    });
  });
});
