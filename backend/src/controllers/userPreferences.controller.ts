import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { userPreferencesService } from "../services/userPreferences.service";
import { handleControllerError } from "../utils/controllerHelpers";

export class UserPreferencesController {
  async getPreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.dbUserId;
      const preferences = await userPreferencesService.getPreferences(userId);
      return res.status(200).json(preferences);
    } catch (error) {
      return handleControllerError(res, "Get preferences error", error, "Failed to get preferences");
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
      return handleControllerError(res, "Update preferences error", error, "Failed to update preferences");
    }
  }

  async resetPreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.dbUserId;
      await userPreferencesService.resetToDefault(userId);
      return res.status(200).json({ message: "Preferences reset to default" });
    } catch (error) {
      return handleControllerError(res, "Reset preferences error", error, "Failed to reset preferences");
    }
  }
}

export const userPreferencesController = new UserPreferencesController();
