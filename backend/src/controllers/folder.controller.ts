import { Request, Response } from "express";
import { folderService } from "../services/folder.service";

export class FolderController {
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

  async getFolderTree(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);

      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const tree = await folderService.getFolderTree(teamId);

      return res.status(200).json({ tree });
    } catch (error) {
      console.error("Get folder tree error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get folder tree",
      });
    }
  }

  async getFolderPath(req: Request, res: Response) {
    try {
      const folderId = parseInt(req.params.folderId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(folderId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid folder ID or team ID" });
      }

      const path = await folderService.getFolderPath(folderId, teamId);

      return res.status(200).json({ path });
    } catch (error) {
      console.error("Get folder path error:", error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Folder not found",
      });
    }
  }

  async createFolder(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      const { name, color, message, parentFolderId } = req.body;

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
        parentFolderId: parentFolderId || null,
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

  async moveFolder(req: Request, res: Response) {
    try {
      const folderId = parseInt(req.params.folderId);
      const teamId = parseInt(req.params.teamId);
      const { parentFolderId } = req.body;

      if (isNaN(folderId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid folder ID or team ID" });
      }

      const targetParentId = parentFolderId === null || parentFolderId === undefined
        ? null
        : parseInt(parentFolderId);

      if (targetParentId !== null && isNaN(targetParentId)) {
        return res.status(400).json({ error: "Invalid parent folder ID" });
      }

      const updatedFolder = await folderService.moveFolder(folderId, teamId, targetParentId);

      return res.status(200).json({
        message: "Folder moved successfully",
        folder: updatedFolder,
      });
    } catch (error) {
      console.error("Move folder error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to move folder";
      const statusCode = errorMessage.includes("Cannot move") ? 400 : 404;
      return res.status(statusCode).json({ error: errorMessage });
    }
  }

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

