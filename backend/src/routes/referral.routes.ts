import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  generateCodeController,
  getCodeController,
  applyCodeController,
  getReferralsController,
  getStatsController,
  validateCodeController,
} from "../controllers/referral.controller";
import { codeValidationService } from "../services/codeValidation.service";

const router = Router();

/**
 * @openapi
 * /referrals/{teamId}/code:
 *   post:
 *     summary: Generate a referral code for a team
 *     description: Creates a new referral code or returns existing one
 *     tags:
 *       - Referrals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Existing referral code returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     code:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       201:
 *         description: New referral code created
 *       401:
 *         description: Unauthorized
 */
router.post("/:teamId/code", requireAuth, generateCodeController);

/**
 * @openapi
 * /referrals/{teamId}/code:
 *   get:
 *     summary: Get referral code for a team
 *     description: Returns the team's referral code if one exists
 *     tags:
 *       - Referrals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Referral code retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                     code:
 *                       type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/:teamId/code", requireAuth, getCodeController);

/**
 * @openapi
 * /referrals/{teamId}/apply:
 *   post:
 *     summary: Apply a referral code to a team
 *     description: Links the team to a referrer using their code
 *     tags:
 *       - Referrals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID to apply code to
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
 *                 description: The referral code to apply
 *     responses:
 *       200:
 *         description: Referral code applied successfully
 *       400:
 *         description: Invalid or already used referral code
 *       401:
 *         description: Unauthorized
 */
router.post("/:teamId/apply", requireAuth, applyCodeController);

/**
 * @openapi
 * /referrals/{teamId}:
 *   get:
 *     summary: Get all referrals for a team
 *     description: Returns the team's referral code and list of referred teams
 *     tags:
 *       - Referrals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Referrals retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: object
 *                   nullable: true
 *                 referrals:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       referredTeamId:
 *                         type: integer
 *                       referredTeamName:
 *                         type: string
 *                       referredEmail:
 *                         type: string
 *                       referredPlan:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [pending, active, churned]
 *                       percentOff:
 *                         type: string
 *                       bonusClips:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get("/:teamId", requireAuth, getReferralsController);

/**
 * @openapi
 * /referrals/{teamId}/stats:
 *   get:
 *     summary: Get referral statistics for a team
 *     description: Returns aggregated referral stats
 *     tags:
 *       - Referrals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Stats retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalReferrals:
 *                   type: integer
 *                 activeReferrals:
 *                   type: integer
 *                 pendingReferrals:
 *                   type: integer
 *                 totalBonusClips:
 *                   type: integer
 *                 totalPercentOff:
 *                   type: number
 *       401:
 *         description: Unauthorized
 */
router.get("/:teamId/stats", requireAuth, getStatsController);

/**
 * @openapi
 * /referrals/validate/{code}:
 *   get:
 *     summary: Validate a referral code
 *     description: Checks if a referral code exists and is valid
 *     tags:
 *       - Referrals
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Referral code to validate
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 code:
 *                   type: string
 */
router.get("/validate/:code", validateCodeController);

/**
 * @openapi
 * /referrals/validate-code/{code}:
 *   get:
 *     summary: Validate a referral code
 *     description: Endpoint to check if a referral code is valid
 *     tags:
 *       - Referrals
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Referral code to validate
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 type:
 *                   type: string
 *                   enum: [referral]
 *                   nullable: true
 *                 code:
 *                   type: string
 */
router.get("/validate-code/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    const result = await codeValidationService.validateCode(code);
    return res.json(result);
  } catch (error) {
    console.error("Validate code error:", error);
    return res.status(500).json({ error: "Failed to validate code" });
  }
});

export default router;
