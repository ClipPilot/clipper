import { Router } from "express";
import { requireAuth, requireSeatAccess } from "../middleware/auth.middleware";
import {
  getIntakeForm,
  upsertIntakeForm,
  submitApplication,
  submitAppeal,
  getApplicationStatus,
  getLatestApplication,
} from "../controllers/intake.controller";

const router = Router();

/**
 * @openapi
 * /intake/teams/{teamId}/form:
 *   get:
 *     summary: Get intake form
 *     description: Retrieves the current intake form data for a team
 *     tags:
 *       - Intake
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *     responses:
 *       200:
 *         description: Intake form data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 form:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                     team_id:
 *                       type: integer
 *                     brand_description:
 *                       type: string
 *                       nullable: true
 *                     company_website_url:
 *                       type: string
 *                       nullable: true
 *                     icps:
 *                       type: array
 *                       nullable: true
 *                       items:
 *                         type: object
 *                     company_socials:
 *                       type: object
 *                       nullable: true
 *                     competitor_socials:
 *                       type: array
 *                       nullable: true
 *                       items:
 *                         type: string
 *                     completed:
 *                       type: boolean
 *       400:
 *         description: Invalid team ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/form", requireAuth, requireSeatAccess, getIntakeForm);

/**
 * @openapi
 * /intake/teams/{teamId}/form:
 *   post:
 *     summary: Save intake form
 *     description: Creates or updates the intake form for a team (draft save)
 *     tags:
 *       - Intake
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
 *             properties:
 *               brand_description:
 *                 type: string
 *               company_website_url:
 *                 type: string
 *               icps:
 *                 type: array
 *                 items:
 *                   type: object
 *               company_socials:
 *                 type: object
 *               competitor_socials:
 *                 type: array
 *                 items:
 *                   type: string
 *               completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Form saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 form:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     team_id:
 *                       type: integer
 *                     brand_description:
 *                       type: string
 *                       nullable: true
 *                     company_website_url:
 *                       type: string
 *                       nullable: true
 *                     completed:
 *                       type: boolean
 *       400:
 *         description: Invalid team ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/form", requireAuth, requireSeatAccess, upsertIntakeForm);

/**
 * @openapi
 * /intake/teams/{teamId}/submit:
 *   post:
 *     summary: Submit application
 *     description: Submits a mass posting application for review
 *     tags:
 *       - Intake
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
 *               - brand_description
 *             properties:
 *               brand_description:
 *                 type: string
 *               company_website_url:
 *                 type: string
 *               icps:
 *                 type: array
 *                 items:
 *                   type: object
 *               company_socials:
 *                 type: object
 *               competitor_socials:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Application submitted
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
 *                       enum: [pending, accepted, rejected, appeal]
 *       400:
 *         description: Missing brand description or invalid team ID
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Pending application or already accepted
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/submit", requireAuth, requireSeatAccess, submitApplication);

/**
 * @openapi
 * /intake/teams/{teamId}/appeal:
 *   post:
 *     summary: Submit appeal
 *     description: Submits an appeal for a previously rejected application
 *     tags:
 *       - Intake
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
 *             properties:
 *               brand_description:
 *                 type: string
 *               company_website_url:
 *                 type: string
 *               icps:
 *                 type: array
 *                 items:
 *                   type: object
 *               company_socials:
 *                 type: object
 *               competitor_socials:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Appeal submitted
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
 *                       enum: [pending, accepted, rejected, appeal]
 *       400:
 *         description: Invalid team ID
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Can only appeal rejected applications
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/appeal", requireAuth, requireSeatAccess, submitAppeal);

/**
 * @openapi
 * /intake/teams/{teamId}/status:
 *   get:
 *     summary: Get application status
 *     description: Returns the current application status for a team
 *     tags:
 *       - Intake
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
 *         description: Application status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IntakeApplicationStatus'
 *       400:
 *         description: Invalid team ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/status", requireAuth, requireSeatAccess, getApplicationStatus);

/**
 * @openapi
 * /intake/teams/{teamId}/application:
 *   get:
 *     summary: Get latest application
 *     description: Retrieves the most recent application for a team
 *     tags:
 *       - Intake
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
 *         description: Latest application data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 application:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                     team_id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       enum: [pending, accepted, rejected, appeal, started, paused, completed]
 *       400:
 *         description: Invalid team ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/application", requireAuth, requireSeatAccess, getLatestApplication);

export default router;
