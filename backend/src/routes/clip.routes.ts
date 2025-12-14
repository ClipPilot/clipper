import { Router, Request, Response, NextFunction } from "express";
import { clipVideoController } from "../controllers/clip.controller";
import { clipManagerController } from "../controllers/clipManager.controller";
import { upload } from "../config/multer";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File too large",
        message: "The uploaded video file exceeds the maximum size limit of 10GB",
        maxSize: "10GB",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error: "Unexpected file",
        message: 'Only one video file should be uploaded with field name "video"',
      });
    }
    if (err.message) {
      return res.status(400).json({
        error: "Upload error",
        message: err.message,
      });
    }
  }
  next(err);
};

router.post("/", requireAuth, upload.single("video"), handleMulterError, clipVideoController);

router.get("/teams/:teamId/clips", requireAuth, clipManagerController.getClips.bind(clipManagerController));

router.get("/teams/:teamId/clips/:clipId", requireAuth, clipManagerController.getClip.bind(clipManagerController));

router.patch("/teams/:teamId/clips/:clipId", requireAuth, clipManagerController.updateClip.bind(clipManagerController));

router.delete("/teams/:teamId/clips/:clipId", requireAuth, clipManagerController.deleteClip.bind(clipManagerController));

router.get("/teams/:teamId/folders/:folderId/clips", requireAuth, clipManagerController.getClipsByFolder.bind(clipManagerController));

export default router;
