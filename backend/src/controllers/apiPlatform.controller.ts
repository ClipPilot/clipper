import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest, ApiKeyRequest } from "../middleware/auth.middleware";
import { apiKeyService } from "../services/apiKey.service";
import { apiBillingService } from "../services/apiBilling.service";
import { stripeService } from "../services/stripe.service";
import { stripe } from "../config/stripe.config";
import { userService } from "../services/user.service";

export const createApiKeyController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const { name, expires_at } = req.body;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }

    const created = await apiKeyService.create(
      teamId,
      req.user!.dbUserId,
      name,
      expires_at ? new Date(expires_at) : undefined,
    );

    return res.status(201).json({
      id: created.id,
      name: created.name,
      key: created.raw,
      key_prefix: created.key_prefix,
      expires_at: created.expires_at,
      created_at: created.created_at,
    });
  } catch (err) {
    console.error("Error in createApiKeyController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create API key",
    });
  }
};

export const listApiKeysController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const keys = await apiKeyService.listByTeam(teamId);
    return res.json({ keys });
  } catch (err) {
    console.error("Error in listApiKeysController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to list API keys",
    });
  }
};

export const revokeApiKeyController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const keyId = parseInt(req.params.keyId);

    if (isNaN(teamId) || isNaN(keyId)) {
      return res.status(400).json({ error: "Invalid team ID or key ID" });
    }

    const revoked = await apiKeyService.revoke(teamId, keyId);

    if (!revoked) {
      return res.status(404).json({ error: "API key not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in revokeApiKeyController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to revoke API key",
    });
  }
};

export const getWalletController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const account = await apiBillingService.getOrCreateAccount(teamId);

    return res.json({
      balance_cents: account.balance_cents,
      total_spent_cents: account.total_spent_cents,
      total_topped_up_cents: account.total_topped_up_cents,
      active: account.active,
    });
  } catch (err) {
    console.error("Error in getWalletController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get wallet",
    });
  }
};

export const createWalletTopUpController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const { amount_cents } = req.body;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    if (!amount_cents || amount_cents < 500) {
      return res.status(400).json({ error: "Minimum top-up is $5.00" });
    }

    const customerId = await stripeService.getOrCreateCustomer(
      teamId,
      req.user!.email,
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: "usd",
      customer: customerId,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: {
        teamId: teamId.toString(),
        type: "api_topup",
        amount_cents: amount_cents.toString(),
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("Error in createWalletTopUpController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create top-up",
    });
  }
};

export const getTopUpStatusController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const { paymentIntentId } = req.params;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    if (!paymentIntentId) {
      return res.status(400).json({ error: "Missing paymentIntentId" });
    }

    const credited = await apiBillingService.isTopUpCredited(teamId, paymentIntentId);

    return res.json({ credited });
  } catch (err) {
    console.error("Error in getTopUpStatusController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to check top-up status",
    });
  }
};

export const getAutoRefillController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const account = await apiBillingService.getOrCreateAccount(teamId);

    return res.json({
      auto_refill: account.auto_refill,
      refill_threshold_cents: account.refill_threshold_cents,
      refill_amount_cents: account.refill_amount_cents,
      has_payment_method: !!account.stripe_payment_method_id,
    });
  } catch (err) {
    console.error("Error in getAutoRefillController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get auto-refill settings",
    });
  }
};

export const updateAutoRefillController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const { auto_refill, refill_threshold_cents, refill_amount_cents } = req.body;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    if (auto_refill === true) {
      const account = await apiBillingService.getAccount(teamId);
      if (!account?.stripe_payment_method_id) {
        return res.status(400).json({
          error: "No payment method on file. Please make a top-up first to save your card.",
        });
      }
    }

    if (refill_threshold_cents !== undefined && refill_threshold_cents < 100) {
      return res.status(400).json({ error: "Threshold must be at least $1.00" });
    }

    if (refill_amount_cents !== undefined && refill_amount_cents < 500) {
      return res.status(400).json({ error: "Refill amount must be at least $5.00" });
    }

    const updated = await apiBillingService.updateAutoRefill(teamId, {
      auto_refill,
      refill_threshold_cents,
      refill_amount_cents,
    });

    return res.json({
      auto_refill: updated.auto_refill,
      refill_threshold_cents: updated.refill_threshold_cents,
      refill_amount_cents: updated.refill_amount_cents,
      has_payment_method: !!updated.stripe_payment_method_id,
    });
  } catch (err) {
    console.error("Error in updateAutoRefillController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to update auto-refill settings",
    });
  }
};

export const getUsageLogsController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const { logs, total } = await apiBillingService.getUsageLogs(teamId, limit, offset);

    return res.json({ logs, total, limit, offset });
  } catch (err) {
    console.error("Error in getUsageLogsController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get usage logs",
    });
  }
};

export const testApiRouteController = async (req: ApiKeyRequest, res: Response) => {
  return res.json({
    status: "working",
    team_id: req.apiKey!.teamId,
    key_name: req.apiKey!.name,
    timestamp: new Date().toISOString(),
  });
};

// ── /v1/wallet (API-key authenticated) ──────────────────────────────

export const getWalletV1Controller = async (req: ApiKeyRequest, res: Response) => {
  try {
    const { teamId } = req.apiKey!;
    const account = await apiBillingService.getOrCreateAccount(teamId);

    return res.json({
      balance_cents: account.balance_cents,
      total_spent_cents: account.total_spent_cents,
      total_topped_up_cents: account.total_topped_up_cents,
      active: account.active,
    });
  } catch (err) {
    console.error("Error in getWalletV1Controller:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to get wallet" });
  }
};

export const createWalletTopUpV1Controller = async (req: ApiKeyRequest, res: Response) => {
  try {
    const { teamId, userId } = req.apiKey!;
    const { amount_cents } = req.body;

    if (!amount_cents || amount_cents < 500) {
      return res.status(400).json({ error: "Minimum top-up is $5.00 (500 cents)" });
    }

    const user = await userService.getUserById(userId);
    const customerId = await stripeService.getOrCreateCustomer(teamId, user.email);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: "usd",
      customer: customerId,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: {
        teamId: teamId.toString(),
        type: "api_topup",
        amount_cents: amount_cents.toString(),
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("Error in createWalletTopUpV1Controller:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to create top-up" });
  }
};

export const getTopUpStatusV1Controller = async (req: ApiKeyRequest, res: Response) => {
  try {
    const { teamId } = req.apiKey!;
    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
      return res.status(400).json({ error: "Missing paymentIntentId" });
    }

    const credited = await apiBillingService.isTopUpCredited(teamId, paymentIntentId);
    return res.json({ credited });
  } catch (err) {
    console.error("Error in getTopUpStatusV1Controller:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to check top-up status" });
  }
};
