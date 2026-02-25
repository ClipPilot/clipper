import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AdminRequest } from "../middleware/admin.middleware";
import { campaignService } from "../services/massPosting/campaign.service";
import { intakeService } from "../services/massPosting/intake.service";

export async function getAllCampaigns(req: AdminRequest, res: Response) {
  try {
    const { status, limit, offset } = req.query;

    const result = await intakeService.getAllApplications({
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

    const application = await intakeService.getApplicationById(id);
    return res.json({ application });
  } catch (error: any) {
    console.error("Get campaign detail error:", error);
    if (error.message === "Application not found") {
      return res.status(404).json({ error: "Campaign not found" });
    }
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch campaign" });
  }
}

export async function approveCampaign(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.campaignId);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid campaign ID" });

    const { quotedCpm, videoMinimum, adminNotes } = req.body;

    if (!quotedCpm || videoMinimum == null) {
      return res.status(400).json({ error: "quotedCpm and videoMinimum are required" });
    }

    const campaign = await campaignService.approveCampaign(
      id,
      String(quotedCpm),
      Number(videoMinimum),
      adminNotes,
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

    const { quotedCpm, videoMinimum, adminNotes } = req.body;

    const campaign = await campaignService.updateCampaign(id, {
      quotedCpm: quotedCpm != null ? String(quotedCpm) : undefined,
      videoMinimum: videoMinimum != null ? Number(videoMinimum) : undefined,
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
