import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.middleware";
import { requireAdminAuth } from "../middleware/admin.middleware";
import {
  getUnreadAnnouncements,
  getAllAnnouncementsForUser,
  dismissAnnouncement,
  dismissAllAnnouncements,
  getAllAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
} from "../controllers/announcement.controller";

const router = Router();

// Rate limiters
const userAnnouncementLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminAnnouncementLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * User Endpoints - Requires authentication
 */

/**
 * @openapi
 * /api/announcements/unread:
 *   get:
 *     summary: Get unread announcements for the authenticated user
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved unread announcements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 announcements:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       priority:
 *                         type: string
 *                         enum: [info, warning, critical]
 *                       icon:
 *                         type: string
 *                       action_label:
 *                         type: string
 *                       action_url:
 *                         type: string
 *                       published_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get("/unread", requireAuth, userAnnouncementLimiter, getUnreadAnnouncements);

/**
 * @openapi
 * /api/announcements/all:
 *   get:
 *     summary: Get all announcements (read and unread) for inbox view
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved all announcements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 announcements:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       priority:
 *                         type: string
 *                         enum: [info, warning, critical]
 *                       icon:
 *                         type: string
 *                       action_label:
 *                         type: string
 *                       action_url:
 *                         type: string
 *                       published_at:
 *                         type: string
 *                         format: date-time
 *                       is_read:
 *                         type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get("/all", requireAuth, userAnnouncementLimiter, getAllAnnouncementsForUser);

/**
 * @openapi
 * /api/announcements/{id}/dismiss:
 *   post:
 *     summary: Dismiss a single announcement
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Announcement ID
 *     responses:
 *       200:
 *         description: Announcement dismissed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid announcement ID
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/dismiss", requireAuth, userAnnouncementLimiter, dismissAnnouncement);

/**
 * @openapi
 * /api/announcements/dismiss-all:
 *   post:
 *     summary: Dismiss all unread announcements
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All announcements dismissed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.post("/dismiss-all", requireAuth, userAnnouncementLimiter, dismissAllAnnouncements);

/**
 * Admin Endpoints - Requires admin authentication with 2FA
 */

/**
 * @openapi
 * /api/admin/announcements:
 *   get:
 *     summary: Get all announcements with optional filters (Admin)
 *     tags: [Admin - Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
 *         description: Filter by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of announcements to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of announcements to skip
 *     responses:
 *       200:
 *         description: Successfully retrieved announcements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 announcements:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 */
router.get("/admin", requireAdminAuth, adminAnnouncementLimiter, getAllAnnouncements);

/**
 * @openapi
 * /api/admin/announcements/{id}:
 *   get:
 *     summary: Get a specific announcement by ID (Admin)
 *     tags: [Admin - Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully retrieved announcement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 announcement:
 *                   type: object
 *       404:
 *         description: Announcement not found
 */
router.get("/admin/:id", requireAdminAuth, adminAnnouncementLimiter, getAnnouncementById);

/**
 * @openapi
 * /api/admin/announcements:
 *   post:
 *     summary: Create a new announcement (Admin)
 *     tags: [Admin - Announcements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               content:
 *                 type: string
 *                 description: HTML content (will be sanitized)
 *               priority:
 *                 type: string
 *                 enum: [info, warning, critical]
 *                 default: info
 *               icon:
 *                 type: string
 *                 description: Iconify icon name
 *               action_label:
 *                 type: string
 *               action_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Announcement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 announcement:
 *                   type: object
 *       400:
 *         description: Validation error
 */
router.post("/admin", requireAdminAuth, adminAnnouncementLimiter, createAnnouncement);

/**
 * @openapi
 * /api/admin/announcements/{id}:
 *   patch:
 *     summary: Update an announcement (Admin)
 *     tags: [Admin - Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [info, warning, critical]
 *               icon:
 *                 type: string
 *               action_label:
 *                 type: string
 *               action_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Announcement updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 announcement:
 *                   type: object
 *       404:
 *         description: Announcement not found
 */
router.patch("/admin/:id", requireAdminAuth, adminAnnouncementLimiter, updateAnnouncement);

/**
 * @openapi
 * /api/admin/announcements/{id}:
 *   delete:
 *     summary: Delete an announcement (Admin)
 *     tags: [Admin - Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Announcement deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Announcement not found
 */
router.delete("/admin/:id", requireAdminAuth, adminAnnouncementLimiter, deleteAnnouncement);

/**
 * @openapi
 * /api/admin/announcements/{id}/publish:
 *   post:
 *     summary: Publish an announcement (Admin)
 *     tags: [Admin - Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Announcement published successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 announcement:
 *                   type: object
 *       404:
 *         description: Announcement not found
 */
router.post("/admin/:id/publish", requireAdminAuth, adminAnnouncementLimiter, publishAnnouncement);

export default router;
