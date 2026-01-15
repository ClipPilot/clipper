import { Router } from "express";
import { userPreferencesController } from "../controllers/userPreferences.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, (req, res) =>
  userPreferencesController.getPreferences(req, res)
);

router.patch("/", requireAuth, (req, res) =>
  userPreferencesController.updatePreferences(req, res)
);

router.post("/reset", requireAuth, (req, res) =>
  userPreferencesController.resetPreferences(req, res)
);

export default router;
