import { Router } from "express";
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
  getAllAffiliates,
  getAffiliateUsers,
} from "../controllers/admin.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin dashboard endpoints for enterprise management
 */

/**
 * @swagger
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
router.post("/login", login);

/**
 * @swagger
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
router.post("/verify-2fa", verify2FA);

/**
 * @swagger
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
 * @swagger
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
 * @swagger
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
 * @swagger
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

/**
 * @openapi
 * /admin/affiliates:
 *   get:
 *     summary: Get all affiliates (admin)
 *     description: Returns all affiliate relationships with full details
 *     tags:
 *       - Admin
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: List of all affiliates
 *       401:
 *         description: Unauthorized
 */
router.get("/affiliates", requireAdminAuth, getAllAffiliates);

/**
 * @openapi
 * /admin/affiliates/users:
 *   get:
 *     summary: Get all affiliate users (admin)
 *     description: Returns all users who are affiliates
 *     tags:
 *       - Admin
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: List of affiliate users
 *       401:
 *         description: Unauthorized
 */
router.get("/affiliates/users", requireAdminAuth, getAffiliateUsers);

export default router;
