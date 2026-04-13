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
  endCampaign,
  getCampaignVideos,
  getCampaignPosts,
  postCampaignClip,
  getMasterAgreement,
  voidAndRegenerateMasterContract,
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
router.post("/resend-2fa", adminAuthLimiter, resend2FA);

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
 *               - newPlan
 *             properties:
 *               teamId:
 *                 type: integer
 *               newPlan:
 *                 type: string
 *                 enum: [enterprise]
 *               clipLimit:
 *                 type: integer
 *               monthlyPrice:
 *                 type: number
 *               customerEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Plan changed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 checkoutUrl:
 *                   type: string
 *                 priceId:
 *                   type: string
 *                 hasPreviousSubscription:
 *                   type: boolean
 *       400:
 *         description: Invalid plan or missing fields
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 referrals:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 */
router.get("/referrals", requireAdminAuth, getAllReferrals);

/**
 * @openapi
 * /admin/affiliates:
 *   get:
 *     summary: Get all affiliates (admin)
 *     description: Returns all affiliate partnerships for admin management
 *     tags:
 *       - Admin
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: List of all affiliates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 affiliates:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 */
router.get("/affiliates", requireAdminAuth, (_req, res) => {
  // Stub — affiliates table not yet created
  return res.json({ affiliates: [] });
});

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
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
 *               minimumFund:
 *                 type: number
 *                 description: Optional minimum fund amount
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
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
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
 *               minimumFund:
 *                 type: number
 *               budget:
 *                 type: number
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
 * /api/admin/campaigns/{campaignId}/end:
 *   post:
 *     summary: End a campaign
 *     description: Ends a started or paused campaign by setting status to completed
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
 *         description: Campaign ended
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *       400:
 *         description: Campaign is not in started or paused status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.post("/campaigns/:campaignId/end", requireAdminAuth, endCampaign);

/**
 * @openapi
 * /api/admin/campaigns/{campaignId}/videos:
 *   get:
 *     summary: List campaign videos
 *     description: Returns all videos associated with a campaign, with presigned URLs.
 *     tags: [Admin - Campaigns]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 25
 *           maximum: 100
 *         description: Number of videos per page
 *     responses:
 *       200:
 *         description: Campaign videos with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 videos:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     totalVideos:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         description: Invalid campaign ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/campaigns/:campaignId/videos", requireAdminAuth, getCampaignVideos);

/**
 * @openapi
 * /admin/campaigns/{campaignId}/posts:
 *   get:
 *     summary: Get campaign posts (admin)
 *     description: Returns all posts for a campaign with filtering and pagination
 *     tags:
 *       - Admin - Campaigns
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tab
 *         schema:
 *           type: string
 *           enum: [queued, published]
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Campaign posts with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.get("/campaigns/:campaignId/posts", requireAdminAuth, getCampaignPosts);

/**
 * @openapi
 * /api/admin/campaigns/{campaignId}/post:
 *   post:
 *     summary: Publish a campaign clip to platforms
 *     description: >
 *       Admin-initiated posting of a campaign clip. Creates posts with campaign_id,
 *       skips credit deduction, and sends SQS job for metadata scrambling and Drive upload.
 *     tags: [Admin - Campaigns]
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
 *               - clipId
 *               - platformQuantities
 *             properties:
 *               clipId:
 *                 type: integer
 *               platformQuantities:
 *                 type: object
 *                 additionalProperties:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 50
 *     responses:
 *       202:
 *         description: Posting job accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 postIds:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       platform:
 *                         type: string
 *       400:
 *         description: Invalid input or missing fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign or clip not found
 *       500:
 *         description: Server error
 */
router.post("/campaigns/:campaignId/post", requireAdminAuth, postCampaignClip);

/**
 * @openapi
 * /api/admin/teams/{teamId}/master-agreement:
 *   get:
 *     summary: Get or generate master agreement for a team
 *     description: Returns the existing master agreement or generates a new unsigned one if none exists.
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Master agreement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreement:
 *                   type: object
 *       400:
 *         description: Invalid team ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/master-agreement", requireAdminAuth, getMasterAgreement);

/**
 * @openapi
 * /api/admin/teams/{teamId}/void-and-regenerate-contract:
 *   post:
 *     summary: Void and regenerate master agreement
 *     description: Voids all existing master agreements for the team and generates a fresh one with updated legal text. Resets contract_ready on accepted campaigns.
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: New master agreement generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreement:
 *                   type: object
 *       400:
 *         description: Invalid team ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/void-and-regenerate-contract", requireAdminAuth, voidAndRegenerateMasterContract);

export default router;
