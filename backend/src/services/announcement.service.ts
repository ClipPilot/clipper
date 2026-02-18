import * as Sentry from "@sentry/node";
import { db } from "../db";
import {
  announcements,
  userAnnouncementDismissals,
  users,
} from "@clipper/shared-db/src/schema";
import { eq, and, desc, lte, gte, sql, notExists, isNotNull } from "drizzle-orm";
import DOMPurify from "isomorphic-dompurify";

interface CreateAnnouncementData {
  title: string;
  content: string;
  priority?: "info" | "warning" | "critical";
  icon?: string;
  action_label?: string;
  action_url?: string;
  created_by_admin_email: string;
}

interface UpdateAnnouncementData {
  title?: string;
  content?: string;
  priority?: "info" | "warning" | "critical";
  icon?: string;
  action_label?: string;
  action_url?: string;
}

interface GetAnnouncementsFilters {
  status?: "draft" | "published" | "archived";
  limit?: number;
  offset?: number;
}

class AnnouncementService {
  /**
   * Sanitize HTML content
   */
  private sanitizeHTML(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "a",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ],
      ALLOWED_ATTR: ["href", "target", "rel"],
      ALLOW_DATA_ATTR: false,
    });
  }

  /**
   * Get unread announcements for a user (for badge count)
   */
  async getUnreadAnnouncementsForUser(userId: number) {
    try {
      // Get user's created_at to only show announcements published after signup
      const [user] = await db
        .select({ created_at: users.created_at })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const unreadAnnouncements = await db
        .select({
          id: announcements.id,
          title: announcements.title,
          content: announcements.content,
          priority: announcements.priority,
          icon: announcements.icon,
          action_label: announcements.action_label,
          action_url: announcements.action_url,
          published_at: announcements.published_at,
        })
        .from(announcements)
        .where(
          and(
            eq(announcements.status, "published"),
            isNotNull(announcements.published_at),
            lte(announcements.published_at, new Date()),
            // Only show announcements published after user signed up
            ...(user ? [gte(announcements.published_at, user.created_at)] : []),
            notExists(
              db
                .select()
                .from(userAnnouncementDismissals)
                .where(
                  and(
                    eq(userAnnouncementDismissals.announcement_id, announcements.id),
                    eq(userAnnouncementDismissals.user_id, userId)
                  )
                )
            )
          )
        )
        .orderBy(desc(announcements.priority), desc(announcements.published_at))
        .limit(50);

      return unreadAnnouncements;
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to fetch unread announcements");
    }
  }

  /**
   * Get all announcements for a user (both read and unread for inbox)
   */
  async getAllAnnouncementsForUser(userId: number) {
    try {
      // Get user's created_at to only show announcements published after signup
      const [user] = await db
        .select({ created_at: users.created_at })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const allAnnouncements = await db
        .select({
          id: announcements.id,
          title: announcements.title,
          content: announcements.content,
          priority: announcements.priority,
          icon: announcements.icon,
          action_label: announcements.action_label,
          action_url: announcements.action_url,
          published_at: announcements.published_at,
          is_read: sql<boolean>`EXISTS (
            SELECT 1 FROM ${userAnnouncementDismissals}
            WHERE ${userAnnouncementDismissals.announcement_id} = ${announcements.id}
            AND ${userAnnouncementDismissals.user_id} = ${userId}
          )`.as("is_read"),
        })
        .from(announcements)
        .where(
          and(
            eq(announcements.status, "published"),
            isNotNull(announcements.published_at),
            lte(announcements.published_at, new Date()),
            // Only show announcements published after user signed up
            ...(user ? [gte(announcements.published_at, user.created_at)] : [])
          )
        )
        .orderBy(desc(announcements.published_at))
        .limit(100);

      return allAnnouncements;
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to fetch announcements");
    }
  }

  /**
   * Dismiss a single announcement for a user
   */
  async dismissAnnouncement(userId: number, announcementId: number) {
    try {
      // Check if already dismissed
      const existing = await db
        .select()
        .from(userAnnouncementDismissals)
        .where(
          and(
            eq(userAnnouncementDismissals.user_id, userId),
            eq(userAnnouncementDismissals.announcement_id, announcementId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return; // Already dismissed
      }

      await db.insert(userAnnouncementDismissals).values({
        user_id: userId,
        announcement_id: announcementId,
      });
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to dismiss announcement");
    }
  }

  /**
   * Dismiss all announcements for a user
   */
  async dismissAllAnnouncements(userId: number) {
    try {
      // Get all unread announcement IDs
      const unread = await this.getUnreadAnnouncementsForUser(userId);

      if (unread.length === 0) {
        return;
      }

      // Insert all dismissals
      const dismissals = unread.map((announcement) => ({
        user_id: userId,
        announcement_id: announcement.id,
      }));

      await db.insert(userAnnouncementDismissals).values(dismissals);
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to dismiss all announcements");
    }
  }

  /**
   * Get all announcements with optional filters (Admin)
   */
  async getAllAnnouncements(filters: GetAnnouncementsFilters = {}) {
    try {
      const { status, limit = 20, offset = 0 } = filters;

      // Build query
      let query = db.select().from(announcements);

      if (status) {
        query = query.where(eq(announcements.status, status)) as typeof query;
      }

      const results = await query
        .orderBy(desc(announcements.created_at))
        .limit(limit)
        .offset(offset);

      // Get total count
      const totalQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(announcements);

      const totalResult = status
        ? await totalQuery.where(eq(announcements.status, status))
        : await totalQuery;

      const total = Number(totalResult[0]?.count || 0);

      return {
        announcements: results,
        total,
      };
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to fetch announcements");
    }
  }

  /**
   * Get announcement by ID (Admin)
   */
  async getAnnouncementById(id: number) {
    try {
      const [announcement] = await db
        .select()
        .from(announcements)
        .where(eq(announcements.id, id))
        .limit(1);

      if (!announcement) {
        throw new Error("Announcement not found");
      }

      return announcement;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Create announcement (Admin)
   */
  async createAnnouncement(data: CreateAnnouncementData) {
    try {
      // Sanitize HTML content
      const sanitizedContent = this.sanitizeHTML(data.content);

      const [announcement] = await db
        .insert(announcements)
        .values({
          title: data.title,
          content: sanitizedContent,
          priority: data.priority || "info",
          icon: data.icon,
          action_label: data.action_label,
          action_url: data.action_url,
          created_by_admin_email: data.created_by_admin_email,
          status: "draft",
        })
        .returning();

      return announcement;
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to create announcement");
    }
  }

  /**
   * Update announcement (Admin)
   */
  async updateAnnouncement(id: number, updates: UpdateAnnouncementData) {
    try {
      // Sanitize content if provided
      if (updates.content) {
        updates.content = this.sanitizeHTML(updates.content);
      }

      const [announcement] = await db
        .update(announcements)
        .set({
          ...updates,
          updated_at: new Date(),
        })
        .where(eq(announcements.id, id))
        .returning();

      if (!announcement) {
        throw new Error("Announcement not found");
      }

      return announcement;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Delete announcement (Admin)
   */
  async deleteAnnouncement(id: number) {
    try {
      await db.delete(announcements).where(eq(announcements.id, id));
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to delete announcement");
    }
  }

  /**
   * Publish announcement (Admin)
   */
  async publishAnnouncement(id: number) {
    try {
      const [announcement] = await db
        .update(announcements)
        .set({
          status: "published",
          published_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(announcements.id, id))
        .returning();

      if (!announcement) {
        throw new Error("Announcement not found");
      }

      return announcement;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }
}

export const announcementService = new AnnouncementService();
