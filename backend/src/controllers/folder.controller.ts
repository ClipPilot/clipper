import { Request, Response } from "express";
import type { Folder, ErrorResponse } from "../types/api.types";
import { folderService } from "../services/folder.service";
import { teamService } from "../services/team.service";
import { handleControllerError, verifyTeamAccessOrFail } from "../utils/controllerHelpers";
import { AuthRequest } from "../middleware/auth.middleware";
import { stripHtmlTags } from "../utils/urlValidator";


export class FolderController {
  async getFolders(req: AuthRequest, res: Response<{ folders: Folder[] } | ErrorResponse>) {
    try {
      const teamId = parseInt(req.params.teamId);

      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;

      const folders = await folderService.getFoldersByTeam(teamId);

      return res.status(200).json({ folders });
    } catch (error) {
      return handleControllerError(res, "Get folders error", error, "Failed to get folders");
    }
  }

  async getFolder(req: Request, res: Response<{ folder: Folder } | ErrorResponse>) {
    try {
      const folderId = parseInt(req.params.folderId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(folderId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid folder ID or team ID" });
      }

      const folder = await folderService.getFolderById(folderId, teamId);

      return res.status(200).json({ folder });
    } catch (error) {
      return handleControllerError(res, "Get folder error", error, "Folder not found", 404);
    }
  }

  async getFolderTree(req: AuthRequest, res: Response<{ tree: Folder[] } | ErrorResponse>) {
    try {
      const teamId = parseInt(req.params.teamId);

      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;

      const tree = await folderService.getFolderTree(teamId);

      return res.status(200).json({ tree });
    } catch (error) {
      return handleControllerError(res, "Get folder tree error", error, "Failed to get folder tree");
    }
  }

  async getFolderPath(req: Request, res: Response<{ path: Folder[] } | ErrorResponse>) {
    try {
      const folderId = parseInt(req.params.folderId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(folderId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid folder ID or team ID" });
      }

      const path = await folderService.getFolderPath(folderId, teamId);

      return res.status(200).json({ path });
    } catch (error) {
      return handleControllerError(res, "Get folder path error", error, "Folder not found", 404);
    }
  }

  async createFolder(req: Request, res: Response<{ message: string; folder: Folder } | ErrorResponse>) {
    try {
      const teamId = parseInt(req.params.teamId);
      const { name: rawName, color, message, parentFolderId } = req.body;
      const name = rawName ? stripHtmlTags(rawName) : rawName;

      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const team = await teamService.getTeamById(teamId);
      if (team.plan !== "scale" && team.plan !== "enterprise") {
        return res.status(403).json({
          error: "Folder management requires a Scale or Enterprise plan. Please upgrade to create folders.",
        });
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
      return handleControllerError(res, "Create folder error", error, "Failed to create folder");
    }
  }

  async updateFolder(req: Request, res: Response<{ message: string; folder: Folder } | ErrorResponse>) {
    try {
      const folderId = parseInt(req.params.folderId);
      const teamId = parseInt(req.params.teamId);
      const { name: rawName, color, message } = req.body;
      const name = rawName ? stripHtmlTags(rawName) : rawName;

      if (isNaN(folderId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid folder ID or team ID" });
      }

      const team = await teamService.getTeamById(teamId);
      if (team.plan !== "scale" && team.plan !== "enterprise") {
        return res.status(403).json({
          error: "Folder management requires a Scale or Enterprise plan. Please upgrade to modify folders.",
        });
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
      return handleControllerError(res, "Update folder error", error, "Failed to update folder", 404);
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

      const team = await teamService.getTeamById(teamId);
      if (team.plan !== "scale" && team.plan !== "enterprise") {
        return res.status(403).json({
          error: "Folder management requires a Scale or Enterprise plan. Please upgrade to move folders.",
        });
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
      const statusCode = error instanceof Error && error.message.includes("Cannot move") ? 400 : 404;
      return handleControllerError(res, "Move folder error", error, "Failed to move folder", statusCode);
    }
  }

  async deleteFolder(req: Request, res: Response) {
    try {
      const folderId = parseInt(req.params.folderId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(folderId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid folder ID or team ID" });
      }

      const team = await teamService.getTeamById(teamId);
      if (team.plan !== "scale" && team.plan !== "enterprise") {
        return res.status(403).json({
          error: "Folder management requires a Scale or Enterprise plan. Please upgrade to delete folders.",
        });
      }

      await folderService.deleteFolder(folderId, teamId);

      return res.status(200).json({
        message: "Folder deleted successfully",
      });
    } catch (error) {
      return handleControllerError(res, "Delete folder error", error, "Failed to delete folder", 404);
    }
  }
}

export const folderController = new FolderController();
