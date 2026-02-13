import { Router } from "express";
import { userPreferencesController } from "../controllers/userPreferences.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /user-preferences:
 *   get:
 *     summary: Get current user preferences
 *     tags:
 *       - User Preferences
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences
 */
router.get("/", requireAuth, (req, res) =>
  userPreferencesController.getPreferences(req, res)
);

/**
 * @openapi
 * /user-preferences:
 *   patch:
 *     summary: Update user preferences
 *     tags:
 *       - User Preferences
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Preferences updated
 */
router.patch("/", requireAuth, (req, res) =>
  userPreferencesController.updatePreferences(req, res)
);

/**
 * @openapi
 * /user-preferences/reset:
 *   post:
 *     summary: Reset user preferences to defaults
 *     tags:
 *       - User Preferences
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences reset
 */
router.post("/reset", requireAuth, (req, res) =>
  userPreferencesController.resetPreferences(req, res)
);

export default router;
