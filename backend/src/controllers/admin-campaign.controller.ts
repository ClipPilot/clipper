import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AdminRequest } from "../middleware/admin.middleware";
import { campaignService } from "../services/massPosting/campaign.service";
import { campaignVideoService } from "../services/massPosting/campaignVideo.service";
import { campaignContractService } from "../services/massPosting/campaignContract.service";
import { adPostingService, AdPostingError } from "../services/adPosting.service";

export async function getAllCampaigns(req: AdminRequest, res: Response) {
  try {
    const { status, limit, offset } = req.query;

    const result = await campaignService.getAllCampaigns({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error("Get all campaigns error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch campaigns" });
  }
}

export async function getCampaignDetail(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.campaignId);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid campaign ID" });

    const campaign = await campaignService.getCampaignDetail(id);
    return res.json({ campaign });
  } catch (error: any) {
    console.error("Get campaign detail error:", error);
    if (error.message === "Campaign not found") {
      return res.status(404).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch campaign" });
  }
}

export async function approveCampaign(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.campaignId);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid campaign ID" });

    const { quotedCpm, videoMinimum, adminNotes, minimumFund } = req.body;

    if (!quotedCpm || videoMinimum == null) {
      return res.status(400).json({ error: "quotedCpm and videoMinimum are required" });
    }

    const campaign = await campaignService.approveCampaign(
      id,
      String(quotedCpm),
      Number(videoMinimum),
      adminNotes,
      minimumFund != null ? Number(minimumFund) : undefined,
    );

    return res.json({ campaign });
  } catch (error: any) {
    console.error("Approve campaign error:", error);
    if (error.message === "Campaign not found") {
      return res.status(404).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to approve campaign" });
  }
}

export async function rejectCampaign(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.campaignId);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid campaign ID" });

    const { rejectionReason, adminNotes } = req.body;
    if (!rejectionReason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const campaign = await campaignService.rejectCampaign(id, rejectionReason, adminNotes);
    return res.json({ campaign });
  } catch (error: any) {
    console.error("Reject campaign error:", error);
    if (error.message === "Campaign not found") {
      return res.status(404).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to reject campaign" });
  }
}

export async function updateCampaign(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.campaignId);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid campaign ID" });

    const { quotedCpm, videoMinimum, adminNotes, minimumFund, budget } = req.body;

    const campaign = await campaignService.updateCampaign(id, {
      quotedCpm: quotedCpm != null ? String(quotedCpm) : undefined,
      videoMinimum: videoMinimum != null ? Number(videoMinimum) : undefined,
      minimumFund: minimumFund != null ? Number(minimumFund) : undefined,
      budget: budget != null ? Number(budget) : undefined,
      adminNotes,
    });

    return res.json({ campaign });
  } catch (error: any) {
    console.error("Update campaign error:", error);
    if (error.message === "Campaign not found") {
      return res.status(404).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to update campaign" });
  }
}

export async function pauseCampaign(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.campaignId);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid campaign ID" });

    const campaign = await campaignService.pauseCampaign(id);
    return res.json({ campaign });
  } catch (error: any) {
    console.error("Pause campaign error:", error);
    if (error.message === "Campaign not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes("Can only pause")) {
      return res.status(400).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to pause campaign" });
  }
}

export async function endCampaign(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.campaignId);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid campaign ID" });

    const campaign = await campaignService.endCampaign(id);
    return res.json({ campaign });
  } catch (error: any) {
    console.error("End campaign error:", error);
    if (error.message === "Campaign not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes("Can only end")) {
      return res.status(400).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to end campaign" });
  }
}

export async function getCampaignVideos(req: AdminRequest, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(campaignId)) return res.status(400).json({ error: "Invalid campaign ID" });

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);

    const result = await campaignVideoService.listVideos(campaignId, { page, pageSize });
    return res.json(result);
  } catch (error) {
    console.error("Get campaign videos error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch campaign videos" });
  }
}

export async function getCampaignPosts(req: AdminRequest, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(campaignId)) return res.status(400).json({ error: "Invalid campaign ID" });

    // Look up team_id from the campaign
    const campaign = await campaignService.getCampaignDetail(campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const { tab, platform, dateRange, search, sortBy, sortOrder, page, pageSize } = req.query;

    const result = await adPostingService.getPostsForTeam(campaign.team_id, {
      tab: tab as "queued" | "published" | undefined,
      platform: platform as string | undefined,
      dateRange: dateRange as string | undefined,
      search: search as string | undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as "asc" | "desc" | undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? Math.min(parseInt(pageSize as string), 100) : undefined,
      campaignId,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("Get campaign posts error:", error);
    if (error.message === "Campaign not found") {
      return res.status(404).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch campaign posts" });
  }
}

export async function getMasterAgreement(req: AdminRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ error: "Invalid team ID" });

    const agreement = await campaignContractService.getOrGenerateMasterAgreement(teamId);
    return res.json({ agreement });
  } catch (error) {
    console.error("Get master agreement error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to get master agreement" });
  }
}

export async function voidAndRegenerateMasterContract(req: AdminRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ error: "Invalid team ID" });

    const agreement = await campaignContractService.voidAndRegenerateMasterAgreement(teamId);
    return res.json({ agreement });
  } catch (error) {
    console.error("Void and regenerate master contract error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to void and regenerate master contract" });
  }
}

export async function postCampaignClip(req: AdminRequest, res: Response) {
  try {
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(campaignId)) return res.status(400).json({ error: "Invalid campaign ID" });

    const { clipId, platformQuantities } = req.body;
    if (!clipId || !platformQuantities) {
      return res.status(400).json({ error: "clipId and platformQuantities are required" });
    }

    const result = await adPostingService.startCampaignPosting(
      campaignId,
      Number(clipId),
      platformQuantities,
    );

    return res.status(202).json({ message: "Campaign posting started", ...result });
  } catch (error: any) {
    console.error("Post campaign clip error:", error);
    if (error instanceof AdPostingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to start campaign posting" });
  }
}
