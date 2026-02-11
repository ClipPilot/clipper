import { Router } from "express";
import { graphicsController } from "../controllers/graphics.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/generate",
  requireAuth,
  graphicsController.generate.bind(graphicsController),
);

router.post(
  "/upload-product-image",
  requireAuth,
  graphicsController.getUploadUrl.bind(graphicsController),
);

export default router;
