import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { adPostingService, AdPostingError, PlatformQuantities } from "../services/adPosting.service";
import { canAccessMassPosting } from "../utils/plans";
import { teamService } from "../services/team.service";

export async function postClipToPlatforms(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const userId = req.user?.dbUserId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const team = await teamService.getTeamById(teamId);
    if (!canAccessMassPosting(team.plan)) {
      return res.status(403).json({ error: "Mass posting requires a Studio plan or higher" });
    }

    const { clipId, platforms, platformQuantities: rawPQ } = req.body;

    if (!clipId || typeof clipId !== "number") {
      return res.status(400).json({ error: "clipId is required and must be a number" });
    }

    // Build platformQuantities — support both old and new format
    let platformQuantities: PlatformQuantities;

    if (rawPQ && typeof rawPQ === "object" && !Array.isArray(rawPQ)) {
      platformQuantities = rawPQ;
    } else if (Array.isArray(platforms) && platforms.length > 0) {
      // Backward compat: convert ["instagram", "tiktok"] → { instagram: 1, tiktok: 1 }
      platformQuantities = {};
      for (const p of platforms) {
        platformQuantities[p] = 1;
      }
    } else {
      return res.status(400).json({
        error: "platformQuantities (object) or platforms (array) is required",
      });
    }

    // Validates inputs, deducts credits, and sends SQS job for worker processing
    await adPostingService.validateAndStart(teamId, clipId, platformQuantities, userId);

    return res.status(202).json({ message: "Ad posting started" });
  } catch (error) {
    if (error instanceof AdPostingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Ad posting error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to start ad posting" });
  }
}

export async function getClipPosts(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const clipId = parseInt(req.params.clipId);

    if (isNaN(teamId) || isNaN(clipId)) {
      return res.status(400).json({ error: "Invalid team ID or clip ID" });
    }

    const posts = await adPostingService.getPostsForClip(teamId, clipId);
    return res.status(200).json({ posts });
  } catch (error) {
    console.error("Get clip posts error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to get clip posts" });
  }
}

export async function webhookMarkAsPosted(req: AuthRequest, res: Response) {
  try {
    // Verify shared secret
    const secret = req.headers["x-webhook-secret"];
    const expected = process.env.AD_POSTING_WEBHOOK_SECRET;
    if (!expected || secret !== expected) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { postId, postUrl } = req.body;

    if (!postId || typeof postId !== "number") {
      return res.status(400).json({ error: "postId is required and must be a number" });
    }

    await adPostingService.markAsPosted(postId, postUrl);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook mark as posted error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to update post status" });
  }
}
