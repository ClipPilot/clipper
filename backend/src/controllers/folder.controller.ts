import { Request, Response } from "express";
import { folderService } from "../services/folder.service";

export class FolderController {
  // Get all folders for a team
  async getFolders(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);

      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const folders = await folderService.getFoldersByTeam(teamId);

      return res.status(200).json({ folders });
    } catch (error) {
      console.error("Get folders error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get folders",
      });
    }
  }

  // Get a single folder
  async getFolder(req: Request, res: Response) {
    try {
      const folderId = parseInt(req.params.folderId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(folderId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid folder ID or team ID" });
      }

      const folder = await folderService.getFolderById(folderId, teamId);

      return res.status(200).json({ folder });
    } catch (error) {
      console.error("Get folder error:", error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Folder not found",
      });
    }
  }

  // Create a new folder
  async createFolder(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      const { name, color, message } = req.body;

      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Folder name is required" });
      }

      const folder = await folderService.createFolder({
        teamId,
        name,
        color,
        message,
      });

      return res.status(201).json({
        message: "Folder created successfully",
        folder,
      });
    } catch (error) {
      console.error("Create folder error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create folder",
      });
    }
  }

  // Update a folder
  async updateFolder(req: Request, res: Response) {
    try {
      const folderId = parseInt(req.params.folderId);
      const teamId = parseInt(req.params.teamId);
      const { name, color, message } = req.body;

      if (isNaN(folderId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid folder ID or team ID" });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      if (message !== undefined) updates.message = message;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const updatedFolder = await folderService.updateFolder(folderId, teamId, updates);

      return res.status(200).json({
        message: "Folder updated successfully",
        folder: updatedFolder,
      });
    } catch (error) {
      console.error("Update folder error:", error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Failed to update folder",
      });
    }
  }

  // Delete a folder
  async deleteFolder(req: Request, res: Response) {
    try {
      const folderId = parseInt(req.params.folderId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(folderId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid folder ID or team ID" });
      }

      await folderService.deleteFolder(folderId, teamId);

      return res.status(200).json({
        message: "Folder deleted successfully",
      });
    } catch (error) {
      console.error("Delete folder error:", error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Failed to delete folder",
      });
    }
  }
}

export const folderController = new FolderController();

