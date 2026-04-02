import { Request, Response } from "express";
import type { Tag, ErrorResponse } from "../types/api.types";
import { tagService } from "../services/tag.service";
import { handleControllerError } from "../utils/controllerHelpers";

export class TagController {
  async getTags(req: Request, res: Response<{ tags: Tag[] } | ErrorResponse>) {
    try {
      const teamId = parseInt(req.params.teamId);

      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const tagsList = await tagService.getTagsByTeam(teamId);

      return res.status(200).json({ tags: tagsList });
    } catch (error) {
      return handleControllerError(res, "Get tags error", error, "Failed to get tags");
    }
  }

  async getTag(req: Request, res: Response<{ tag: Tag } | ErrorResponse>) {
    try {
      const tagId = parseInt(req.params.tagId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(tagId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid tag ID or team ID" });
      }

      const tag = await tagService.getTagById(tagId, teamId);

      return res.status(200).json({ tag });
    } catch (error) {
      return handleControllerError(res, "Get tag error", error, "Tag not found", 404);
    }
  }

  async createTag(req: Request, res: Response<{ message: string; tag: Tag } | ErrorResponse>) {
    try {
      const teamId = parseInt(req.params.teamId);
      const { name, color } = req.body;

      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Tag name is required" });
      }

      const tag = await tagService.createTag({
        teamId,
        name: name.trim(),
        color,
      });

      return res.status(201).json({
        message: "Tag created successfully",
        tag,
      });
    } catch (error) {
      return handleControllerError(res, "Create tag error", error, "Failed to create tag");
    }
  }

  async updateTag(req: Request, res: Response<{ message: string; tag: Tag } | ErrorResponse>) {
    try {
      const tagId = parseInt(req.params.tagId);
      const teamId = parseInt(req.params.teamId);
      const { name, color } = req.body;

      if (isNaN(tagId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid tag ID or team ID" });
      }

      const updates: { name?: string; color?: string } = {};
      if (name !== undefined) updates.name = name.trim();
      if (color !== undefined) updates.color = color;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const updatedTag = await tagService.updateTag(tagId, teamId, updates);

      return res.status(200).json({
        message: "Tag updated successfully",
        tag: updatedTag,
      });
    } catch (error) {
      return handleControllerError(res, "Update tag error", error, "Failed to update tag", 404);
    }
  }

  async deleteTag(req: Request, res: Response<{ message: string } | ErrorResponse>) {
    try {
      const tagId = parseInt(req.params.tagId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(tagId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid tag ID or team ID" });
      }

      await tagService.deleteTag(tagId, teamId);

      return res.status(200).json({
        message: "Tag deleted successfully",
      });
    } catch (error) {
      return handleControllerError(res, "Delete tag error", error, "Failed to delete tag", 404);
    }
  }

  async getClipTags(req: Request, res: Response<{ tags: Tag[] } | ErrorResponse>) {
    try {
      const clipId = parseInt(req.params.clipId);

      if (isNaN(clipId)) {
        return res.status(400).json({ error: "Invalid clip ID" });
      }

      const clipTags = await tagService.getTagsForClip(clipId);

      return res.status(200).json({ tags: clipTags });
    } catch (error) {
      return handleControllerError(res, "Get clip tags error", error, "Failed to get clip tags");
    }
  }

  async addTagToClip(req: Request, res: Response<{ message: string; tags: Tag[] } | ErrorResponse>) {
    try {
      const clipId = parseInt(req.params.clipId);
      const tagId = parseInt(req.params.tagId);

      if (isNaN(clipId) || isNaN(tagId)) {
        return res.status(400).json({ error: "Invalid clip ID or tag ID" });
      }

      await tagService.addTagToClip(clipId, tagId);
      const clipTags = await tagService.getTagsForClip(clipId);

      return res.status(200).json({
        message: "Tag added to clip",
        tags: clipTags,
      });
    } catch (error) {
      return handleControllerError(res, "Add tag to clip error", error, "Failed to add tag to clip");
    }
  }

  async removeTagFromClip(req: Request, res: Response<{ message: string; tags: Tag[] } | ErrorResponse>) {
    try {
      const clipId = parseInt(req.params.clipId);
      const tagId = parseInt(req.params.tagId);

      if (isNaN(clipId) || isNaN(tagId)) {
        return res.status(400).json({ error: "Invalid clip ID or tag ID" });
      }

      await tagService.removeTagFromClip(clipId, tagId);
      const clipTags = await tagService.getTagsForClip(clipId);

      return res.status(200).json({
        message: "Tag removed from clip",
        tags: clipTags,
      });
    } catch (error) {
      return handleControllerError(res, "Remove tag from clip error", error, "Failed to remove tag from clip");
    }
  }

  async setClipTags(req: Request, res: Response<{ message: string; tags: Tag[] } | ErrorResponse>) {
    try {
      const clipId = parseInt(req.params.clipId);
      const { tagIds } = req.body;

      if (isNaN(clipId)) {
        return res.status(400).json({ error: "Invalid clip ID" });
      }

      if (!Array.isArray(tagIds)) {
        return res.status(400).json({ error: "tagIds must be an array" });
      }

      const clipTags = await tagService.setClipTags(clipId, tagIds);

      return res.status(200).json({
        message: "Clip tags updated",
        tags: clipTags,
      });
    } catch (error) {
      return handleControllerError(res, "Set clip tags error", error, "Failed to set clip tags");
    }
  }
}

export const tagController = new TagController();
