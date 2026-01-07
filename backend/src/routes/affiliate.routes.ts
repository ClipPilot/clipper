import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  generateCodeController,
  getCodeController,
  getAffiliatedTeamsController,
  getStatsController,
  becomeAffiliateController,
  validateCodeController,
  applyCodeController,
  getMeController,
} from "../controllers/affiliate.controller";

const router = Router();

/**
 * @openapi
 * /affiliates/me:
 *   get:
 *     summary: Get current user's affiliate status
 *     tags:
 *       - Affiliates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Affiliate status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isAffiliate:
 *                   type: boolean
 */
router.get("/me", requireAuth, getMeController);

/**
 * @openapi
 * /affiliates/become:
 *   post:
 *     summary: Register as an affiliate
 *     tags:
 *       - Affiliates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully registered as affiliate
 */
router.post("/become", requireAuth, becomeAffiliateController);

/**
 * @openapi
 * /affiliates/code:
 *   post:
 *     summary: Generate affiliate code
 *     tags:
 *       - Affiliates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Existing affiliate code returned
 *       201:
 *         description: New affiliate code created
 *       403:
 *         description: User is not an affiliate
 */
router.post("/code", requireAuth, generateCodeController);

/**
 * @openapi
 * /affiliates/code:
 *   get:
 *     summary: Get affiliate code
 *     tags:
 *       - Affiliates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Affiliate code retrieved
 */
router.get("/code", requireAuth, getCodeController);

/**
 * @openapi
 * /affiliates/teams:
 *   get:
 *     summary: Get affiliated teams (brands)
 *     tags:
 *       - Affiliates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of affiliated teams
 */
router.get("/teams", requireAuth, getAffiliatedTeamsController);

/**
 * @openapi
 * /affiliates/stats:
 *   get:
 *     summary: Get affiliate statistics
 *     tags:
 *       - Affiliates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Affiliate statistics
 */
router.get("/stats", requireAuth, getStatsController);

/**
 * @openapi
 * /affiliates/validate/{code}:
 *   get:
 *     summary: Validate an affiliate code
 *     tags:
 *       - Affiliates
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Validation result
 */
router.get("/validate/:code", validateCodeController);

/**
 * @openapi
 * /affiliates/{teamId}/apply:
 *   post:
 *     summary: Apply affiliate code to team
 *     tags:
 *       - Affiliates
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
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Affiliate code applied
 *       400:
 *         description: Invalid or already used code
 */
router.post("/:teamId/apply", requireAuth, applyCodeController);

export default router;
