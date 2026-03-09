import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { campaignService } from "../services/massPosting/campaign.service";
import { campaignVideoService } from "../services/massPosting/campaignVideo.service";
import { campaignBillingService } from "../services/massPosting/campaignBilling.service";
import { campaignContractService } from "../services/massPosting/campaignContract.service";
import { stripe } from "../config/stripe.config";
import { stripeService } from "../services/stripe.service";

// ── Campaign CRUD ────────────────────────────────

export async function createCampaign(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ error: "Invalid team ID" });

    const { brand_description, company_website_url, icps, company_socials, competitor_socials, budget, name } = req.body;

    const campaign = await campaignService.createCampaign(
      teamId,
      { brand_description, company_website_url, icps, company_socials, competitor_socials },
      budget != null ? Number(budget) : undefined,
      name,
    );

    return res.status(201).json({ campaign });
  } catch (error: any) {
    console.error("Create campaign error:", error);
    if (error.message?.includes("already have a pending") || error.message?.includes("already been accepted")) {
      return res.status(409).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create campaign" });
  }
}

export async function listCampaigns(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ error: "Invalid team ID" });

    const { status, limit, offset } = req.query;
    const result = await campaignService.getCampaignsForTeam(teamId, {
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error("List campaigns error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to list campaigns" });
  }
}

export async function getCampaign(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(teamId) || isNaN(campaignId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const campaign = await campaignService.getCampaignForTeamById(teamId, campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const gates = await campaignService.checkGates(campaignId);
    return res.json({ campaign, gates });
  } catch (error) {
    console.error("Get campaign error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch campaign" });
  }
}

export async function appealCampaign(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(teamId) || isNaN(campaignId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const { brand_description, company_website_url, icps, company_socials, competitor_socials } = req.body;
    const campaign = await campaignService.submitAppeal(teamId, campaignId, {
      brand_description, company_website_url, icps, company_socials, competitor_socials,
    });

    return res.json({ campaign });
  } catch (error: any) {
    console.error("Appeal campaign error:", error);
    if (error.message?.includes("Can only appeal")) {
      return res.status(409).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to submit appeal" });
  }
}

// ── Videos ───────────────────────────────────────

export async function addVideos(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(teamId) || isNaN(campaignId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const { clipIds } = req.body;
    if (!Array.isArray(clipIds) || clipIds.length === 0) {
      return res.status(400).json({ error: "clipIds array is required" });
    }

    const videos = await campaignVideoService.addClipsFromLibrary(campaignId, teamId, clipIds);
    return res.status(201).json({ videos });
  } catch (error: any) {
    console.error("Add videos error:", error);
    if (error.message?.includes("not found or not owned")) {
      return res.status(400).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to add videos" });
  }
}

export async function uploadVideo(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(teamId) || isNaN(campaignId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) {
      return res.status(400).json({ error: "fileName and contentType are required" });
    }

    const result = await campaignVideoService.createCustomUpload(campaignId, teamId, fileName, contentType);
    return res.json(result);
  } catch (error) {
    console.error("Upload video error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create upload URL" });
  }
}

export async function completeVideoUpload(req: AuthRequest, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const teamId = parseInt(req.params.teamId);
    const videoId = parseInt(req.params.videoId);
    if (isNaN(campaignId) || isNaN(videoId) || isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const userId = req.user!.dbUserId;
    const video = await campaignVideoService.completeCustomUpload(campaignId, videoId, teamId, userId);
    return res.json({ video });
  } catch (error: any) {
    console.error("Complete video upload error:", error);
    if (error.message === "Video not found") {
      return res.status(404).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to complete upload" });
  }
}

export async function removeVideo(req: AuthRequest, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const videoId = parseInt(req.params.videoId);
    if (isNaN(campaignId) || isNaN(videoId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    await campaignVideoService.removeVideo(campaignId, videoId);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Remove video error:", error);
    if (error.message === "Video not found") {
      return res.status(404).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to remove video" });
  }
}

export async function listVideos(req: AuthRequest, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(campaignId)) return res.status(400).json({ error: "Invalid campaign ID" });

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 500, 500);
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as string | undefined;
    const validSortBy = ["created_at", "title", "publish_status", "post_count"].includes(sortBy ?? "")
      ? (sortBy as "created_at" | "title" | "publish_status" | "post_count")
      : undefined;
    const validSortOrder = sortOrder === "asc" || sortOrder === "desc" ? sortOrder : undefined;

    const result = await campaignVideoService.listVideos(campaignId, {
      page, pageSize, sortBy: validSortBy, sortOrder: validSortOrder,
    });
    return res.json(result);
  } catch (error) {
    console.error("List videos error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to list videos" });
  }
}

// ── Wallet ───────────────────────────────────────

export async function getWallet(req: AuthRequest, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const teamId = parseInt(req.params.teamId);
    if (isNaN(campaignId) || isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    let wallet = await campaignBillingService.getOrCreateWallet(campaignId, teamId);

    // Auto-populate payment method from a past campaign wallet if this one has none
    if (!wallet.stripe_payment_method_id) {
      const existingPmId = await campaignBillingService.getTeamPaymentMethod(teamId, campaignId);
      if (existingPmId) {
        await campaignBillingService.savePaymentMethod(campaignId, teamId, existingPmId);
        wallet = await campaignBillingService.getWallet(campaignId) ?? wallet;
      }
    }

    let paymentMethod: {
      type: "card" | "us_bank_account";
      brand?: string;
      last4: string;
      exp_month?: number;
      exp_year?: number;
      bank_name?: string;
    } | null = null;

    if (wallet.stripe_payment_method_id) {
      try {
        const pm = await stripe.paymentMethods.retrieve(wallet.stripe_payment_method_id);
        if (pm.card) {
          paymentMethod = {
            type: "card",
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          };
        } else if (pm.us_bank_account) {
          paymentMethod = {
            type: "us_bank_account",
            last4: pm.us_bank_account.last4 ?? "",
            bank_name: pm.us_bank_account.bank_name ?? undefined,
          };
        }
      } catch {}
    }

    return res.json({ wallet, card: paymentMethod });
  } catch (error) {
    console.error("Get wallet error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch wallet" });
  }
}

export async function createTopUp(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(teamId) || isNaN(campaignId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const amount_cents = req.body.amount_cents ?? req.body.amountCents;
    if (!amount_cents || amount_cents < 100) {
      return res.status(400).json({ error: "amount_cents must be at least 100" });
    }

    const customerId = await stripeService.getOrCreateCustomer(
      teamId,
      req.user!.email,
    );

    // Check if wallet has a saved payment method
    const wallet = await campaignBillingService.getWallet(campaignId);
    const savedPm = wallet?.stripe_payment_method_id;

    if (savedPm) {
      // Check if saved PM is a card (can confirm instantly) or bank account (async)
      const pm = await stripe.paymentMethods.retrieve(savedPm);
      const isCard = pm.type === "card";

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount_cents,
        currency: "usd",
        customer: customerId,
        payment_method: savedPm,
        payment_method_types: ["card", "us_bank_account"],
        confirm: true,
        off_session: isCard,
        metadata: {
          teamId: teamId.toString(),
          campaignId: campaignId.toString(),
          type: "campaign_topup",
          amount_cents: amount_cents.toString(),
        },
      });

      // Cards settle instantly — credit wallet now (idempotent, webhook is a safe no-op).
      // ACH goes to "processing" — webhook credits wallet when the bank transfer clears.
      if (paymentIntent.status === "succeeded") {
        await campaignBillingService.topUp(campaignId, teamId, amount_cents, paymentIntent.id);
      }

      return res.json({
        confirmed: paymentIntent.status === "succeeded",
        processing: paymentIntent.status === "processing",
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      });
    }

    // No saved payment method — return clientSecret for manual payment
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: "usd",
      customer: customerId,
      setup_future_usage: "off_session",
      payment_method_types: ["card", "us_bank_account"],
      metadata: {
        teamId: teamId.toString(),
        campaignId: campaignId.toString(),
        type: "campaign_topup",
        amount_cents: amount_cents.toString(),
      },
    });

    return res.json({
      confirmed: false,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Create top-up error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create top-up" });
  }
}

export async function createSetupIntent(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(teamId) || isNaN(campaignId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const customerId = await stripeService.getOrCreateCustomer(teamId, req.user!.email);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card", "us_bank_account"],
      metadata: {
        teamId: teamId.toString(),
        campaignId: campaignId.toString(),
        type: "campaign_payment_setup",
      },
    });

    return res.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    console.error("Create setup intent error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create setup intent" });
  }
}

export async function saveCard(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(teamId) || isNaN(campaignId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const { paymentMethodId } = req.body;
    if (!paymentMethodId) {
      return res.status(400).json({ error: "paymentMethodId is required" });
    }

    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    await campaignBillingService.savePaymentMethod(campaignId, teamId, paymentMethodId);

    return res.json({
      saved: true,
      card: pm.card ? { brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year } : null,
    });
  } catch (error) {
    console.error("Save card error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to save card" });
  }
}

export async function getTopUpStatus(req: AuthRequest, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const piId = req.params.piId;
    if (isNaN(campaignId) || !piId) {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    const credited = await campaignBillingService.isTopUpCredited(campaignId, piId);
    return res.json({ credited });
  } catch (error) {
    console.error("Get top-up status error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to check top-up status" });
  }
}

// ── Fund with Credits ────────────────────────────

export async function fundWithCredits(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(teamId) || isNaN(campaignId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const creditCount = parseInt(req.body.creditCount);
    if (isNaN(creditCount) || creditCount < 1) {
      return res.status(400).json({ error: "creditCount must be at least 1" });
    }

    const result = await campaignBillingService.fundWithCredits(campaignId, teamId, creditCount);
    return res.json({ confirmed: true, ...result });
  } catch (error: any) {
    console.error("Fund with credits error:", error);
    if (error.message === "Insufficient credits") {
      return res.status(400).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fund with credits" });
  }
}

// ── Master Agreement ─────────────────────────────

export async function getMasterAgreement(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ error: "Invalid team ID" });

    const agreement = await campaignContractService.getOrGenerateMasterAgreement(teamId);
    return res.json({ agreement });
  } catch (error) {
    console.error("Get master agreement error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch agreement" });
  }
}

export async function signMasterAgreement(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ error: "Invalid team ID" });

    const { legalEntityName, signerName, signerTitle, signerEmail, signatureDataUrl } = req.body;
    if (!legalEntityName || !signerName || !signerTitle || !signerEmail || !signatureDataUrl) {
      return res.status(400).json({
        error: "legalEntityName, signerName, signerTitle, signerEmail, and signatureDataUrl are required",
      });
    }

    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress
      || "unknown";

    const agreement = await campaignContractService.signMasterAgreement(
      teamId,
      req.user!.dbUserId,
      { legalEntityName, signerName, signerTitle, signerEmail, signatureDataUrl },
      ipAddress,
    );

    return res.json({ agreement });
  } catch (error: any) {
    console.error("Sign master agreement error:", error);
    if (error.message === "Agreement already signed") {
      return res.status(409).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to sign agreement" });
  }
}

// ── Campaign Clip IDs ────────────────────────────

export async function getCampaignClipIds(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ error: "Invalid team ID" });

    const result = await campaignVideoService.getClipIdsInCampaigns(teamId);
    return res.json(result);
  } catch (error) {
    console.error("Get campaign clip IDs error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch campaign clip IDs" });
  }
}

// ── End Campaign ─────────────────────────────────

export async function endCampaign(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(teamId) || isNaN(campaignId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const campaign = await campaignService.endCampaign(campaignId);
    return res.json({ campaign });
  } catch (error: any) {
    console.error("End campaign error:", error);
    if (error.message?.includes("Can only end")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Campaign not found") {
      return res.status(404).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to end campaign" });
  }
}

// ── Start Campaign ───────────────────────────────

export async function startCampaign(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(teamId) || isNaN(campaignId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const campaign = await campaignService.startCampaign(teamId, campaignId);
    return res.json({ campaign });
  } catch (error: any) {
    console.error("Start campaign error:", error);
    if (error.message?.includes("must be") || error.message?.includes("gates")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Campaign not found") {
      return res.status(404).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to start campaign" });
  }
}
