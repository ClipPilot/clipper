import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { userPreferencesService } from "../services/userPreferences.service";
import { sanitizeErrorForFrontend } from "../utils/errorSanitizer";

export class UserPreferencesController {
  async getPreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.dbUserId;
      const preferences = await userPreferencesService.getPreferences(userId);
      return res.status(200).json(preferences);
    } catch (error) {
      console.error("Get preferences error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to get preferences"),
      });
    }
  }

  async updatePreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.dbUserId;
      const { dashboardLayout, widgetColors } = req.body;

      const preferences = await userPreferencesService.updatePreferences(userId, {
        dashboardLayout,
        widgetColors,
      });

      return res.status(200).json(preferences);
    } catch (error) {
      console.error("Update preferences error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to update preferences"),
      });
    }
  }

  async resetPreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.dbUserId;
      await userPreferencesService.resetToDefault(userId);
      return res.status(200).json({ message: "Preferences reset to default" });
    } catch (error) {
      console.error("Reset preferences error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to reset preferences"),
      });
    }
  }
}

export const userPreferencesController = new UserPreferencesController();
