import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import { announcementService } from "../services/announcement.service";
import { AdminRequest } from "../middleware/admin.middleware";
import { emitNewAnnouncement } from "../services/socket.service";

/**
 * User Controllers
 */

// Get unread announcements for authenticated user (badge count)
export async function getUnreadAnnouncements(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.dbUserId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const announcements = await announcementService.getUnreadAnnouncementsForUser(userId);
    return res.json({ announcements });
  } catch (error) {
    console.error("Get unread announcements error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }
}

// Get all announcements for authenticated user (inbox view)
export async function getAllAnnouncementsForUser(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.dbUserId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const announcements = await announcementService.getAllAnnouncementsForUser(userId);
    return res.json({ announcements });
  } catch (error) {
    console.error("Get all announcements for user error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }
}

// Dismiss a single announcement
export async function dismissAnnouncement(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.dbUserId;
    const announcementId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!announcementId || isNaN(announcementId)) {
      return res.status(400).json({ error: "Invalid announcement ID" });
    }

    await announcementService.dismissAnnouncement(userId, announcementId);
    return res.json({ success: true, message: "Announcement dismissed" });
  } catch (error) {
    console.error("Dismiss announcement error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to dismiss announcement" });
  }
}

// Dismiss all announcements
export async function dismissAllAnnouncements(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.dbUserId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await announcementService.dismissAllAnnouncements(userId);
    return res.json({ success: true, message: "All announcements dismissed" });
  } catch (error) {
    console.error("Dismiss all announcements error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to dismiss announcements" });
  }
}

/**
 * Admin Controllers
 */

// Get all announcements with optional filters
export async function getAllAnnouncements(req: AdminRequest, res: Response) {
  try {
    const { status, limit, offset } = req.query;

    const result = await announcementService.getAllAnnouncements({
      status: status as "draft" | "published" | "archived" | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error("Get all announcements error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }
}

// Get single announcement by ID
export async function getAnnouncementById(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid announcement ID" });
    }

    const announcement = await announcementService.getAnnouncementById(id);
    return res.json({ announcement });
  } catch (error) {
    console.error("Get announcement by ID error:", error);
    Sentry.captureException(error);

    if (error instanceof Error && error.message === "Announcement not found") {
      return res.status(404).json({ error: "Announcement not found" });
    }

    return res.status(500).json({ error: "Failed to fetch announcement" });
  }
}

// Create new announcement
export async function createAnnouncement(req: AdminRequest, res: Response) {
  try {
    const { title, content, priority, icon, action_label, action_url } = req.body;

    // Validation
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    if (title.length > 255) {
      return res.status(400).json({ error: "Title must be 255 characters or less" });
    }

    if (action_label && !action_url) {
      return res.status(400).json({ error: "Action URL is required when action label is provided" });
    }

    // Get admin email from authenticated request
    const adminEmail = req.admin?.email;
    if (!adminEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const announcement = await announcementService.createAnnouncement({
      title,
      content,
      priority,
      icon,
      action_label,
      action_url,
      created_by_admin_email: adminEmail,
    });

    return res.status(201).json({ announcement });
  } catch (error) {
    console.error("Create announcement error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create announcement" });
  }
}

// Update announcement
export async function updateAnnouncement(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const { title, content, priority, icon, action_label, action_url } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid announcement ID" });
    }

    if (title && title.length > 255) {
      return res.status(400).json({ error: "Title must be 255 characters or less" });
    }

    if (action_label && !action_url) {
      return res.status(400).json({ error: "Action URL is required when action label is provided" });
    }

    const announcement = await announcementService.updateAnnouncement(id, {
      title,
      content,
      priority,
      icon,
      action_label,
      action_url,
    });

    return res.json({ announcement });
  } catch (error) {
    console.error("Update announcement error:", error);
    Sentry.captureException(error);

    if (error instanceof Error && error.message === "Announcement not found") {
      return res.status(404).json({ error: "Announcement not found" });
    }

    return res.status(500).json({ error: "Failed to update announcement" });
  }
}

// Delete announcement
export async function deleteAnnouncement(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid announcement ID" });
    }

    await announcementService.deleteAnnouncement(id);
    return res.json({ success: true, message: "Announcement deleted" });
  } catch (error) {
    console.error("Delete announcement error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to delete announcement" });
  }
}

// Publish announcement
export async function publishAnnouncement(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid announcement ID" });
    }

    const announcement = await announcementService.publishAnnouncement(id);

    // Broadcast announcement to all users via Socket.io
    emitNewAnnouncement(announcement);

    return res.json({ announcement });
  } catch (error) {
    console.error("Publish announcement error:", error);
    Sentry.captureException(error);

    if (error instanceof Error && error.message === "Announcement not found") {
      return res.status(404).json({ error: "Announcement not found" });
    }

    return res.status(500).json({ error: "Failed to publish announcement" });
  }
}
