import { Router } from "express";
import { requireAuth, requireSeatAccess } from "../middleware/auth.middleware";
import {
  postClipToPlatforms,
  getClipPosts,
  webhookMarkAsPosted,
} from "../controllers/adPosting.controller";

const router = Router();

router.post(
  "/teams/:teamId/post",
  requireAuth,
  requireSeatAccess,
  postClipToPlatforms
);

router.get(
  "/teams/:teamId/clips/:clipId/posts",
  requireAuth,
  requireSeatAccess,
  getClipPosts
);

// Botfarm webhook — no auth middleware (called by external service)
router.post("/webhook/posted", webhookMarkAsPosted);

export default router;
