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
  getAllApplications,
  getApplication,
  approveApplication,
  rejectApplication,
  retryDriveFolder,
} from "../controllers/admin-intake.controller";

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

// Mass Posting Applications

/**
 * @openapi
 * /api/admin/applications:
 *   get:
 *     summary: Get all mass-posting applications
 *     description: Returns a paginated list of mass-posting applications, optionally filtered by status
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected, appeal]
 *         description: Filter by application status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Paginated list of applications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 applications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       team_id:
 *                         type: integer
 *                       status:
 *                         type: string
 *                       google_drive_folder_id:
 *                         type: string
 *                         nullable: true
 *                       rejection_reason:
 *                         type: string
 *                         nullable: true
 *                       admin_notes:
 *                         type: string
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                       team_name:
 *                         type: string
 *                       team_plan:
 *                         type: string
 *                 total:
 *                   type: integer
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch applications
 */
router.get("/applications", requireAdminAuth, getAllApplications);

/**
 * @openapi
 * /api/admin/applications/{applicationId}:
 *   get:
 *     summary: Get application by ID
 *     description: Returns a single mass-posting application with its intake form data
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Application ID
 *     responses:
 *       200:
 *         description: Application details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 application:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     team_id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     google_drive_folder_id:
 *                       type: string
 *                       nullable: true
 *                     rejection_reason:
 *                       type: string
 *                       nullable: true
 *                     admin_notes:
 *                       type: string
 *                       nullable: true
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                     team_name:
 *                       type: string
 *                     team_plan:
 *                       type: string
 *                     intakeForm:
 *                       type: object
 *                       nullable: true
 *       400:
 *         description: Invalid application ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Application not found
 *       500:
 *         description: Failed to fetch application
 */
router.get("/applications/:applicationId", requireAdminAuth, getApplication);

/**
 * @openapi
 * /api/admin/applications/{applicationId}/approve:
 *   post:
 *     summary: Approve an application
 *     description: Approves a mass-posting application and creates a Google Drive folder for the team
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Application ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminNotes:
 *                 type: string
 *                 description: Optional notes from admin
 *     responses:
 *       200:
 *         description: Application approved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 application:
 *                   type: object
 *       400:
 *         description: Invalid application ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Application not found
 *       500:
 *         description: Failed to approve application
 */
router.post("/applications/:applicationId/approve", requireAdminAuth, approveApplication);

/**
 * @openapi
 * /api/admin/applications/{applicationId}/reject:
 *   post:
 *     summary: Reject an application
 *     description: Rejects a mass-posting application with a required reason
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Application ID
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
 *                 description: Reason for rejecting the application
 *               adminNotes:
 *                 type: string
 *                 description: Optional notes from admin
 *     responses:
 *       200:
 *         description: Application rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 application:
 *                   type: object
 *       400:
 *         description: Invalid application ID or missing rejection reason
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Application not found
 *       500:
 *         description: Failed to reject application
 */
router.post("/applications/:applicationId/reject", requireAdminAuth, rejectApplication);

/**
 * @openapi
 * /api/admin/applications/{applicationId}/retry-drive:
 *   post:
 *     summary: Retry Google Drive folder creation
 *     description: Retries creating a Google Drive folder for an approved application that failed folder creation
 *     tags: [Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Application ID
 *     responses:
 *       200:
 *         description: Drive folder created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 application:
 *                   type: object
 *                   properties:
 *                     google_drive_folder_id:
 *                       type: string
 *       400:
 *         description: Invalid application ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Application not found
 *       409:
 *         description: Drive folder already exists or application not in correct status
 *       500:
 *         description: Failed to create Drive folder
 */
router.post("/applications/:applicationId/retry-drive", requireAdminAuth, retryDriveFolder);

export default router;
