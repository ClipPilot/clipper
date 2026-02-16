import { Request, Response } from "express";
import { graphicsService, GraphicType, GenerationMode } from "../services/ai-ugc/graphics.service";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { s3Service } from "../services/s3.service";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { sanitizeErrorForFrontend } from "../utils/errorSanitizer";
import type { AspectRatio } from "../services/ai-ugc/falImage.service";

interface AuthRequest extends Request {
  user?: { id: string; email: string; dbUserId: number };
}

const VALID_GRAPHIC_TYPES: GraphicType[] = [
  "instagram-ad",
  "facebook-ad",
  "product-showcase",
  "banner-display-ad",
  "custom",
];

const VALID_ASPECT_RATIOS: AspectRatio[] = [
  "1:1", "9:16", "16:9", "4:5", "3:4", "2:3",
];

const VALID_MODES: GenerationMode[] = ["variations", "carousel"];

const CREDIT_COST = 4;

export class GraphicsController {
  async generate(req: AuthRequest, res: Response) {
    try {
      const { teamId, prompt, graphicType, aspectRatio, productImageKeys, mode = "variations" } = req.body;

      if (!teamId || !prompt || !graphicType || !aspectRatio) {
        return res.status(400).json({
          error: "teamId, prompt, graphicType, and aspectRatio are required",
        });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!VALID_GRAPHIC_TYPES.includes(graphicType)) {
        return res.status(400).json({ error: "Invalid graphic type" });
      }

      if (!VALID_ASPECT_RATIOS.includes(aspectRatio)) {
        return res.status(400).json({ error: "Invalid aspect ratio" });
      }

      if (!VALID_MODES.includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'variations' or 'carousel'" });
      }

      if (productImageKeys && productImageKeys.length > 4) {
        return res.status(400).json({ error: "Maximum 4 product images allowed" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const usage = await getTeamUsage(teamId);
      if (!usage) {
        return res.status(404).json({ error: "Team usage stats not found" });
      }
      if (usage.totalRemaining < CREDIT_COST) {
        return res.status(403).json({
          error: `Insufficient credits. Graphics generation requires ${CREDIT_COST} credits, but you have ${usage.totalRemaining} remaining.`,
          code: "INSUFFICIENT_CREDITS",
          required: CREDIT_COST,
          available: usage.totalRemaining,
        });
      }

      await teamService.incrementTeamUsage(teamId, CREDIT_COST);

      try {
        const images = await graphicsService.generateGraphics({
          teamId,
          prompt,
          graphicType,
          aspectRatio,
          mode,
          productImageKeys,
        });

        return res.status(200).json({
          success: true,
          images,
        });
      } catch (genError) {
        console.error("[GRAPHICS] Generation failed, refunding credit:", genError);
        await teamService.decrementTeamUsage(teamId, CREDIT_COST);
        throw genError;
      }
    } catch (error) {
      console.error("[GRAPHICS] Generate error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to generate graphics"),
      });
    }
  }

  async getUploadUrl(req: AuthRequest, res: Response) {
    try {
      const { teamId, fileName, contentType } = req.body;

      if (!teamId || !fileName) {
        return res.status(400).json({ error: "teamId and fileName are required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const { uploadUrl, s3Key } = await s3Service.getProductImagePresignedUpload(
        teamId,
        fileName,
        contentType || "image/jpeg",
      );

      return res.status(200).json({
        success: true,
        uploadUrl,
        s3Key,
      });
    } catch (error) {
      console.error("[GRAPHICS] Upload URL error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to get upload URL"),
      });
    }
  }
}

export const graphicsController = new GraphicsController();
