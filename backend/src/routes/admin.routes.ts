import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAdminAuth } from "../middleware/admin.middleware";
import {
  login,
  verify2FA,
  resend2FA,
  getAllTeams,
  getTeam,
  setupEnterprise,
  changePlan,
  getAllReferrals,
  setReferralReward,
} from "../controllers/admin.controller";
import {
  getAllCampaigns,
  getCampaignDetail,
  approveCampaign,
  rejectCampaign,
  updateCampaign,
  pauseCampaign,
  getContractAdmin,
  generateContractAdmin,
  updateContractAdmin,
} from "../controllers/admin-campaign.controller";

const router = Router();

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @openapi
 * tags:
 *   name: Admin
 *   description: Admin dashboard endpoints for enterprise management
 */

/**
 * @openapi
 * /api/admin/login:
 *   post:
 *     summary: Admin login - Step 1 (credentials validation)
 *     description: Validates credentials and sends a 2FA code to the admin email. Code expires in 15 minutes.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLoginRequest'
 *     responses:
 *       200:
 *         description: Credentials valid, 2FA code sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification code sent to your email
 *                 email:
 *                   type: string
 *                   example: admin@cuttr.com
 *                 requires2FA:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", adminAuthLimiter, login);

/**
 * @openapi
 * /api/admin/verify-2fa:
 *   post:
 *     summary: Admin login - Step 2 (2FA verification)
 *     description: Verifies the 6-digit code and returns a JWT token
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Admin email address
 *               code:
 *                 type: string
 *                 description: 6-digit verification code
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Verification successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminLoginResponse'
 *       401:
 *         description: Invalid or expired verification code
 */
router.post("/verify-2fa", adminAuthLimiter, verify2FA);

/**
 * @openapi
 * /api/admin/resend-2fa:
 *   post:
 *     summary: Resend 2FA code
 *     description: Validates credentials again and sends a new 2FA code
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLoginRequest'
 *     responses:
 *       200:
 *         description: New code sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: New verification code sent to your email
 *                 email:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 */
router.post("/resend-2fa", resend2FA);

/**
 * @openapi
 * /api/admin/teams:
 *   get:
 *     summary: Get all teams
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: List of all teams
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teams:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminTeam'
 *       401:
 *         description: Unauthorized
 */
router.get("/teams", requireAdminAuth, getAllTeams);

/**
 * @openapi
 * /api/admin/teams/{teamId}:
 *   get:
 *     summary: Get team by ID
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 team:
 *                   $ref: '#/components/schemas/AdminTeam'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 */
router.get("/teams/:teamId", requireAdminAuth, getTeam);

/**
 * @openapi
 * /api/admin/enterprise/setup:
 *   post:
 *     summary: Setup enterprise subscription for a team
 *     description: Creates a custom Stripe price and generates a checkout URL for the enterprise customer
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EnterpriseSetupRequest'
 *     responses:
 *       200:
 *         description: Enterprise setup successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnterpriseSetupResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 *       500:
 *         description: Setup failed
 */
router.post("/enterprise/setup", requireAdminAuth, setupEnterprise);

/**
 * @openapi
 * /admin/teams/change-plan:
 *   post:
 *     summary: Change a team's subscription plan (admin)
 *     tags:
 *       - Admin
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - plan
 *             properties:
 *               teamId:
 *                 type: integer
 *               plan:
 *                 type: string
 *     responses:
 *       200:
 *         description: Plan changed
 *       404:
 *         description: Team not found
 */
router.post("/teams/change-plan", requireAdminAuth, changePlan);

/**
 * @openapi
 * /admin/referrals:
 *   get:
 *     summary: Get all referrals (admin)
 *     description: Returns all referrals with full details for admin management
 *     tags:
 *       - Admin
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: List of all referrals
 *       401:
 *         description: Unauthorized
 */
router.get("/referrals", requireAdminAuth, getAllReferrals);

/**
 * @openapi
 * /admin/referrals/reward:
 *   post:
 *     summary: Set referral reward (admin)
 *     description: Set bonus clips or percent off for a referral
 *     tags:
 *       - Admin
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - referralId
 *             properties:
 *               referralId:
 *                 type: integer
 *               bonusClips:
 *                 type: integer
 *                 default: 0
 *               percentOff:
 *                 type: number
 *                 default: 0
 *     responses:
 *       200:
 *         description: Reward set successfully
 *       404:
 *         description: Referral not found
 *       401:
 *         description: Unauthorized
 */
router.post("/referrals/reward", requireAdminAuth, setReferralReward);

// Campaign Management

/**
 * @openapi
 * /api/admin/campaigns:
 *   get:
 *     summary: List all campaigns
 *     description: Returns a paginated list of all campaigns with team info, filterable by status
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected, appeal, started, paused, completed]
 *         description: Filter by campaign status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Paginated list of campaigns
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/campaigns", requireAdminAuth, getAllCampaigns);

/**
 * @openapi
 * /api/admin/campaigns/{campaignId}:
 *   get:
 *     summary: Get campaign detail
 *     description: Returns full campaign detail including gate statuses, video count, wallet balance, and contract status
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Campaign details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.get("/campaigns/:campaignId", requireAdminAuth, getCampaignDetail);

/**
 * @openapi
 * /api/admin/campaigns/{campaignId}/approve:
 *   post:
 *     summary: Approve a campaign
 *     description: Approves a pending campaign. Requires quotedCpm and videoMinimum. Auto-generates the contract PDF.
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
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
 *               - quotedCpm
 *               - videoMinimum
 *             properties:
 *               quotedCpm:
 *                 type: number
 *                 description: CPM rate quoted for the campaign
 *               videoMinimum:
 *                 type: integer
 *                 description: Minimum number of videos required
 *               adminNotes:
 *                 type: string
 *                 description: Optional admin notes
 *     responses:
 *       200:
 *         description: Campaign approved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *       400:
 *         description: Missing quotedCpm or videoMinimum
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.post("/campaigns/:campaignId/approve", requireAdminAuth, approveCampaign);

/**
 * @openapi
 * /api/admin/campaigns/{campaignId}/reject:
 *   post:
 *     summary: Reject a campaign
 *     description: Rejects a pending campaign with a required reason
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Campaign rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *       400:
 *         description: Missing rejection reason
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.post("/campaigns/:campaignId/reject", requireAdminAuth, rejectCampaign);

/**
 * @openapi
 * /api/admin/campaigns/{campaignId}:
 *   patch:
 *     summary: Update campaign settings
 *     description: Updates campaign CPM, video minimum, or admin notes
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quotedCpm:
 *                 type: number
 *               videoMinimum:
 *                 type: integer
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Campaign updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.patch("/campaigns/:campaignId", requireAdminAuth, updateCampaign);

/**
 * @openapi
 * /api/admin/campaigns/{campaignId}/pause:
 *   post:
 *     summary: Pause a started campaign
 *     description: Pauses a currently running campaign
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Campaign paused
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 *       409:
 *         description: Campaign is not in started status
 *       500:
 *         description: Server error
 */
router.post("/campaigns/:campaignId/pause", requireAdminAuth, pauseCampaign);

/**
 * @openapi
 * /api/admin/campaigns/{campaignId}/contract:
 *   get:
 *     summary: Get campaign contract with presigned PDF URL
 *     description: Returns the contract for a campaign including a presigned URL to preview the PDF and editable clause text
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contract details with PDF URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contract:
 *                   type: object
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/campaigns/:campaignId/contract", requireAdminAuth, getContractAdmin);

/**
 * @openapi
 * /api/admin/campaigns/{campaignId}/contract/generate:
 *   post:
 *     summary: Generate contract PDF
 *     description: Generates (or regenerates) the contract PDF for a campaign. Used when auto-generation on approval failed.
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contract generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contract:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign or team not found
 *       500:
 *         description: Failed to generate contract
 */
router.post("/campaigns/:campaignId/contract/generate", requireAdminAuth, generateContractAdmin);

/**
 * @openapi
 * /api/admin/campaigns/{campaignId}/contract:
 *   put:
 *     summary: Update contract clauses and regenerate PDF
 *     description: Edits contract clause text and regenerates the unsigned PDF. Cannot edit signed contracts.
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
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
 *               parties:
 *                 type: string
 *               providerObligations:
 *                 type: string
 *               clientObligations:
 *                 type: string
 *               paymentTerms:
 *                 type: string
 *               additionalClauses:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Contract updated and PDF regenerated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contract:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Contract not found
 *       409:
 *         description: Cannot edit a signed contract
 *       500:
 *         description: Server error
 */
router.put("/campaigns/:campaignId/contract", requireAdminAuth, updateContractAdmin);

export default router;
