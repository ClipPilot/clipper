import { Router } from "express";
import { userPreferencesController } from "../controllers/userPreferences.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /user/preferences:
 *   get:
 *     summary: Get user preferences
 *     description: Retrieves the authenticated user's dashboard preferences
 *     tags:
 *       - User Preferences
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dashboardLayout:
 *                   type: object
 *                 widgetColors:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", requireAuth, (req, res) =>
  userPreferencesController.getPreferences(req, res)
);

/**
 * @openapi
 * /user/preferences:
 *   patch:
 *     summary: Update user preferences
 *     description: Partially updates the authenticated user's dashboard preferences
 *     tags:
 *       - User Preferences
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dashboardLayout:
 *                 type: object
 *                 description: Dashboard layout configuration
 *               widgetColors:
 *                 type: object
 *                 description: Widget color overrides
 *     responses:
 *       200:
 *         description: Updated preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dashboardLayout:
 *                   type: object
 *                 widgetColors:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch("/", requireAuth, (req, res) =>
  userPreferencesController.updatePreferences(req, res)
);

/**
 * @openapi
 * /user/preferences/reset:
 *   post:
 *     summary: Reset user preferences
 *     description: Resets the authenticated user's preferences to default values
 *     tags:
 *       - User Preferences
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/reset", requireAuth, (req, res) =>
  userPreferencesController.resetPreferences(req, res)
);

export default router;
