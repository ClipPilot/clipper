import { Request, Response } from "express";
import { clipManagerService } from "../services/clipManager.service";

export class ClipManagerController {
  // Get all clips for a team
  async getClips(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);

      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const clips = await clipManagerService.getClipsByTeam(teamId);

      return res.status(200).json({ clips });
    } catch (error) {
      console.error("Get clips error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get clips",
      });
    }
  }

  // Get a single clip
  async getClip(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const clip = await clipManagerService.getClipById(clipId, teamId);

      return res.status(200).json({ clip });
    } catch (error) {
      console.error("Get clip error:", error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Clip not found",
      });
    }
  }

  // Update a clip
  async updateClip(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { message, clipScore, folderId } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const updates: any = {};
      if (message !== undefined) updates.message = message;
      if (clipScore !== undefined) updates.clipScore = clipScore;
      if (folderId !== undefined) updates.folderId = folderId;

      const updatedClip = await clipManagerService.updateClip(clipId, teamId, updates);

      return res.status(200).json({
        message: "Clip updated successfully",
        clip: updatedClip,
      });
    } catch (error) {
      console.error("Update clip error:", error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Failed to update clip",
      });
    }
  }

  // Get clips by folder
  async getClipsByFolder(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      const folderId = parseInt(req.params.folderId);

      if (isNaN(teamId) || isNaN(folderId)) {
        return res.status(400).json({ error: "Invalid team ID or folder ID" });
      }

      const clips = await clipManagerService.getClipsByFolder(teamId, folderId);

      return res.status(200).json({ clips });
    } catch (error) {
      console.error("Get clips by folder error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get clips",
      });
    }
  }

  // Delete a clip
  async deleteClip(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      await clipManagerService.deleteClip(clipId, teamId);

      return res.status(200).json({
        message: "Clip deleted successfully",
      });
    } catch (error) {
      console.error("Delete clip error:", error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Failed to delete clip",
      });
    }
  }
}

export const clipManagerController = new ClipManagerController();

