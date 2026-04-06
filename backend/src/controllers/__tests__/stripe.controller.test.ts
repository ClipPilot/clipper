import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockResponse } from "../../../test/helpers/express.helper";
import type { AuthRequest } from "../../middleware/auth.middleware";
import type { Request } from "express";

const { mockStripeService, mockStripeSDK, mockSTRIPE_PRICES, mockENV, mockUserService, mockTeamService } = vi.hoisted(() => ({
  mockStripeService: {
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    getTeamSubscription: vi.fn(),
    getTeamPlan: vi.fn(),
    handleCheckoutCompleted: vi.fn(),
    handleSubscriptionCreated: vi.fn(),
    handleSubscriptionUpdated: vi.fn(),
    handleSubscriptionDeleted: vi.fn(),
    handleAsyncPaymentFailed: vi.fn(),
    handleInvoicePaymentSucceeded: vi.fn(),
    handleInvoicePaymentFailed: vi.fn(),
    handlePaymentIntentSucceeded: vi.fn(),
    changePlan: vi.fn(),
  },
  mockStripeSDK: {
    webhooks: { constructEvent: vi.fn() },
  },
  mockSTRIPE_PRICES: {
    CREATOR: "price_creator",
    STUDIO: "price_studio",
    SCALE: "price_scale",
    ADDON_100: "price_addon_100",
  } as Record<string, string>,
  mockENV: {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
  },
  mockUserService: {
    getUserBySupabaseUid: vi.fn(),
  },
  mockTeamService: {
    verifyTeamAccess: vi.fn(),
    getUserTeamRole: vi.fn(),
  },
}));

vi.mock("../../services/stripe.service", () => ({ stripeService: mockStripeService }));
vi.mock("../../config/stripe.config", () => ({ stripe: mockStripeSDK, STRIPE_PRICES: mockSTRIPE_PRICES }));
vi.mock("../../config/env", () => ({ ENV: mockENV }));
vi.mock("../../services/user.service", () => ({ userService: mockUserService }));
vi.mock("../../services/team.service", () => ({ teamService: mockTeamService }));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

import {
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  handleWebhook,
  getPrices,
  changePlan,
} from "../stripe.controller";

function createReq(overrides: Record<string, any> = {}): AuthRequest {
  return { headers: {}, params: {}, body: {}, query: {}, ...overrides } as unknown as AuthRequest;
}

function setupOwnerMocks() {
  mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
  mockTeamService.verifyTeamAccess.mockResolvedValue(true);
  mockTeamService.getUserTeamRole.mockResolvedValue("owner");
}

function setupMemberMocks() {
  mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
  mockTeamService.verifyTeamAccess.mockResolvedValue(true);
  mockTeamService.getUserTeamRole.mockResolvedValue("member");
}

describe("createCheckoutSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ body: { teamId: "1", priceId: "price_studio" } });
    const res = createMockResponse();
    await createCheckoutSession(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when teamId or priceId missing", async () => {
    const req = createReq({ user: { id: "uid-123", email: "a@b.com" }, body: { teamId: "1" } });
    const res = createMockResponse();
    await createCheckoutSession(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when user is not team owner", async () => {
    setupMemberMocks();
    const req = createReq({
      user: { id: "uid-123", email: "a@b.com" },
      body: { teamId: "1", priceId: "price_studio" },
    });
    const res = createMockResponse();
    await createCheckoutSession(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when user has no team access", async () => {
    mockUserService.getUserBySupabaseUid.mockResolvedValue({ id: 1 });
    mockTeamService.verifyTeamAccess.mockResolvedValue(false);
    const req = createReq({
      user: { id: "uid-123", email: "a@b.com" },
      body: { teamId: "1", priceId: "price_studio" },
    });
    const res = createMockResponse();
    await createCheckoutSession(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 400 for invalid priceId", async () => {
    setupOwnerMocks();
    const req = createReq({
      user: { id: "uid-123", email: "a@b.com" },
      body: { teamId: "1", priceId: "price_bogus" },
    });
    const res = createMockResponse();
    await createCheckoutSession(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns checkout URL on success", async () => {
    setupOwnerMocks();
    mockStripeService.createCheckoutSession.mockResolvedValue("https://checkout.stripe.com/session");
    const req = createReq({
      user: { id: "uid-123", email: "a@b.com" },
      headers: { origin: "https://app.cuttr.com" },
      body: { teamId: "1", priceId: "price_studio" },
    });
    const res = createMockResponse();
    await createCheckoutSession(req, res);
    expect(res.json).toHaveBeenCalledWith({ url: "https://checkout.stripe.com/session" });
  });
});

describe("createPortalSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ body: { teamId: "1" } });
    const res = createMockResponse();
    await createPortalSession(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when teamId missing", async () => {
    const req = createReq({ user: { id: "u1" }, body: {} });
    const res = createMockResponse();
    await createPortalSession(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when user is not team owner", async () => {
    setupMemberMocks();
    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1" },
    });
    const res = createMockResponse();
    await createPortalSession(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns portal URL on success", async () => {
    setupOwnerMocks();
    mockStripeService.createPortalSession.mockResolvedValue("https://billing.stripe.com/portal");
    const req = createReq({
      user: { id: "u1" },
      headers: { origin: "https://app.cuttr.com" },
      body: { teamId: "1" },
    });
    const res = createMockResponse();
    await createPortalSession(req, res);
    expect(res.json).toHaveBeenCalledWith({ url: "https://billing.stripe.com/portal" });
  });
});

describe("getSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ params: { teamId: "1" } });
    const res = createMockResponse();
    await getSubscription(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 when user is not team owner", async () => {
    setupMemberMocks();
    const req = createReq({ user: { id: "u1" }, params: { teamId: "1" } });
    const res = createMockResponse();
    await getSubscription(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns subscription and plan", async () => {
    setupOwnerMocks();
    mockStripeService.getTeamSubscription.mockResolvedValue({ id: 1, plan: "studio" });
    mockStripeService.getTeamPlan.mockResolvedValue("studio");
    const req = createReq({ user: { id: "u1" }, params: { teamId: "1" } });
    const res = createMockResponse();
    await getSubscription(req, res);
    expect(res.json).toHaveBeenCalledWith({
      subscription: { id: 1, plan: "studio" },
      plan: "studio",
    });
  });
});

describe("handleWebhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when signature verification fails", async () => {
    mockStripeSDK.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const req = { headers: { "stripe-signature": "sig_bad" }, body: "{}" } as unknown as Request;
    const res = createMockResponse();
    await handleWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("routes checkout.session.completed to handler", async () => {
    mockStripeSDK.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1" } },
    });
    mockStripeService.handleCheckoutCompleted.mockResolvedValue(undefined);

    const req = { headers: { "stripe-signature": "sig_valid" }, body: "{}" } as unknown as Request;
    const res = createMockResponse();
    await handleWebhook(req, res);
    expect(mockStripeService.handleCheckoutCompleted).toHaveBeenCalledWith({ id: "cs_1" });
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it("routes customer.subscription.created to handler", async () => {
    mockStripeSDK.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.created",
      data: { object: { id: "sub_1" } },
    });
    mockStripeService.handleSubscriptionCreated.mockResolvedValue(undefined);

    const req = { headers: { "stripe-signature": "sig_valid" }, body: "{}" } as unknown as Request;
    const res = createMockResponse();
    await handleWebhook(req, res);
    expect(mockStripeService.handleSubscriptionCreated).toHaveBeenCalledWith({ id: "sub_1" });
  });

  it("routes customer.subscription.deleted to handler", async () => {
    mockStripeSDK.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_2" } },
    });
    mockStripeService.handleSubscriptionDeleted.mockResolvedValue(undefined);

    const req = { headers: { "stripe-signature": "sig_valid" }, body: "{}" } as unknown as Request;
    const res = createMockResponse();
    await handleWebhook(req, res);
    expect(mockStripeService.handleSubscriptionDeleted).toHaveBeenCalledWith({ id: "sub_2" });
  });

  it("returns 500 when webhook secret not configured", async () => {
    const savedSecret = mockENV.STRIPE_WEBHOOK_SECRET;
    mockENV.STRIPE_WEBHOOK_SECRET = "";

    const req = { headers: { "stripe-signature": "sig" }, body: "{}" } as unknown as Request;
    const res = createMockResponse();
    await handleWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(500);

    mockENV.STRIPE_WEBHOOK_SECRET = savedSecret;
  });

  it("handles unrecognized event types gracefully", async () => {
    mockStripeSDK.webhooks.constructEvent.mockReturnValue({
      type: "some.unknown.event",
      data: { object: {} },
    });

    const req = { headers: { "stripe-signature": "sig_valid" }, body: "{}" } as unknown as Request;
    const res = createMockResponse();
    await handleWebhook(req, res);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});

describe("getPrices", () => {
  it("returns STRIPE_PRICES", async () => {
    const req = {} as Request;
    const res = createMockResponse();
    await getPrices(req, res);
    expect(res.json).toHaveBeenCalledWith({ prices: mockSTRIPE_PRICES });
  });
});

describe("changePlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no user", async () => {
    const req = createReq({ body: { teamId: "1", newPriceId: "price_scale" } });
    const res = createMockResponse();
    await changePlan(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when fields missing", async () => {
    const req = createReq({ user: { id: "u1" }, body: { teamId: "1" } });
    const res = createMockResponse();
    await changePlan(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 403 when user is not team owner", async () => {
    setupMemberMocks();
    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1", newPriceId: "price_scale" },
    });
    const res = createMockResponse();
    await changePlan(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 400 for invalid price (not creator/studio/scale)", async () => {
    setupOwnerMocks();
    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1", newPriceId: "price_addon_100" },
    });
    const res = createMockResponse();
    await changePlan(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("changes plan successfully", async () => {
    setupOwnerMocks();
    mockStripeService.changePlan.mockResolvedValue({
      success: true,
      effectiveDate: new Date("2025-03-01"),
      newPlan: "scale",
    });
    const req = createReq({
      user: { id: "u1" },
      body: { teamId: "1", newPriceId: "price_scale" },
    });
    const res = createMockResponse();
    await changePlan(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, newPlan: "scale" }));
  });
});
