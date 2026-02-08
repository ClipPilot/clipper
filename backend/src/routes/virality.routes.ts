import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  listTargetsController,
  addTargetController,
  getTargetController,
  deleteTargetController,
  syncTargetController,
  getPostsController,
  getDashboardController,
  listCompetitorsController,
  createCompetitorController,
  getCompetitorController,
  deleteCompetitorController,
} from "../controllers/virality.controller";

const router = Router();

/**
 * @openapi
 * /virality/{teamId}/targets:
 *   get:
 *     summary: List all tracked targets for a team
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of targets
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/targets", requireAuth, listTargetsController);

/**
 * @openapi
 * /virality/{teamId}/targets:
 *   post:
 *     summary: Add a new target to track
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *               - profileUrl
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [instagram]
 *               profileUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Target created
 *       400:
 *         description: Invalid input or limit reached
 *       403:
 *         description: Plan upgrade required
 *       409:
 *         description: Target already exists
 */
router.post("/:teamId/targets", requireAuth, addTargetController);

/**
 * @openapi
 * /virality/{teamId}/targets/{targetId}:
 *   get:
 *     summary: Get a specific target
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Target details
 *       404:
 *         description: Target not found
 */
router.get("/:teamId/targets/:targetId", requireAuth, getTargetController);

/**
 * @openapi
 * /virality/{teamId}/targets/{targetId}:
 *   delete:
 *     summary: Remove a tracked target
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Target deleted
 *       404:
 *         description: Target not found
 */
router.delete("/:teamId/targets/:targetId", requireAuth, deleteTargetController);

/**
 * @openapi
 * /virality/{teamId}/targets/{targetId}/sync:
 *   post:
 *     summary: Trigger a sync for a target
 *     description: Fetches latest posts and metrics from Instagram
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sync completed
 *       403:
 *         description: Plan upgrade required
 *       404:
 *         description: Target not found
 *       500:
 *         description: Sync failed
 */
router.post("/:teamId/targets/:targetId/sync", requireAuth, syncTargetController);

/**
 * @openapi
 * /virality/{teamId}/targets/{targetId}/posts:
 *   get:
 *     summary: Get posts for a target
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of posts
 *       404:
 *         description: Target not found
 */
router.get("/:teamId/targets/:targetId/posts", requireAuth, getPostsController);

/**
 * @openapi
 * /virality/{teamId}/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags:
 *       - Virality
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *       403:
 *         description: Plan upgrade required
 */
router.get("/:teamId/dashboard", requireAuth, getDashboardController);

// ── Competitor routes ──

router.get("/:teamId/competitors", requireAuth, listCompetitorsController);
router.post("/:teamId/competitors", requireAuth, createCompetitorController);
router.get("/:teamId/competitors/:competitorId", requireAuth, getCompetitorController);
router.delete("/:teamId/competitors/:competitorId", requireAuth, deleteCompetitorController);

export default router;
