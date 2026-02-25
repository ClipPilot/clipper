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
    const videoId = parseInt(req.params.videoId);
    if (isNaN(campaignId) || isNaN(videoId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const video = await campaignVideoService.completeCustomUpload(campaignId, videoId);
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

    const videos = await campaignVideoService.listVideos(campaignId);
    return res.json({ videos });
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

    const wallet = await campaignBillingService.getOrCreateWallet(campaignId, teamId);
    return res.json({ wallet });
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

    const { amount_cents } = req.body;
    if (!amount_cents || amount_cents < 100) {
      return res.status(400).json({ error: "amount_cents must be at least 100" });
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
        campaignId: campaignId.toString(),
        type: "campaign_topup",
        amount_cents: amount_cents.toString(),
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Create top-up error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create top-up" });
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

// ── Contract ─────────────────────────────────────

export async function getContract(req: AuthRequest, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(campaignId)) return res.status(400).json({ error: "Invalid campaign ID" });

    const contract = await campaignContractService.getContract(campaignId);
    return res.json({ contract });
  } catch (error) {
    console.error("Get contract error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch contract" });
  }
}

export async function signContract(req: AuthRequest, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(campaignId)) return res.status(400).json({ error: "Invalid campaign ID" });

    const { legalName, signatureDataUrl } = req.body;
    if (!legalName || !signatureDataUrl) {
      return res.status(400).json({ error: "legalName and signatureDataUrl are required" });
    }

    // Get contract for this campaign
    const contract = await campaignContractService.getContract(campaignId);
    if (!contract) {
      return res.status(404).json({ error: "No contract found for this campaign" });
    }

    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress
      || "unknown";

    const signed = await campaignContractService.signContract(
      contract.id,
      req.user!.dbUserId,
      legalName,
      signatureDataUrl,
      ipAddress,
    );

    return res.json({ contract: signed });
  } catch (error: any) {
    console.error("Sign contract error:", error);
    if (error.message === "Contract already signed") {
      return res.status(409).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to sign contract" });
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
