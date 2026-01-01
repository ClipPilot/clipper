import { Router } from "express";
import { faceSwapController } from "../controllers/faceSwap.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { upload } from "../config/multer";

const router = Router();

// Trim video - accepts multipart form data with video file
// Only the trimmed result is uploaded to S3
router.post("/trim", requireAuth, upload.single("video"), faceSwapController.trimVideo);

export default router;
