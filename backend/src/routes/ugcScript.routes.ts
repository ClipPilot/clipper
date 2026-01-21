import { Router } from "express";
import { ugcScriptController } from "../controllers/ugcScript.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/generate-script",
  requireAuth,
  ugcScriptController.generateScript.bind(ugcScriptController)
);

router.post(
  "/regenerate-scene",
  requireAuth,
  ugcScriptController.regenerateScene.bind(ugcScriptController)
);

router.post(
  "/regenerate-broll-prompt",
  requireAuth,
  ugcScriptController.regenerateBRollPrompt.bind(ugcScriptController)
);

router.post(
  "/upload-product-image",
  requireAuth,
  ugcScriptController.getUploadUrl.bind(ugcScriptController)
);

router.put(
  "/script/:scriptId",
  requireAuth,
  ugcScriptController.updateScript.bind(ugcScriptController)
);

router.get(
  "/script/:scriptId/full",
  requireAuth,
  ugcScriptController.getFullScript.bind(ugcScriptController)
);

router.get(
  "/script/:scriptId/status",
  requireAuth,
  ugcScriptController.getScriptStatus.bind(ugcScriptController)
);

router.get(
  "/scripts/:teamId",
  requireAuth,
  ugcScriptController.listScripts.bind(ugcScriptController)
);

export default router;
