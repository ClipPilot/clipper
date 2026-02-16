import { Router } from "express";
import { graphicsController } from "../controllers/graphics.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @openapi
 * /graphics/generate:
 *   post:
 *     summary: Generate graphics for a clip
 *     tags:
 *       - Graphics
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
 *         description: Graphics generation started
 */
router.post(
  "/generate",
  requireAuth,
  graphicsController.generate.bind(graphicsController),
);

/**
 * @openapi
 * /graphics/upload-product-image:
 *   post:
 *     summary: Get upload URL for a product image
 *     tags:
 *       - Graphics
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - fileName
 *             properties:
 *               teamId:
 *                 type: number
 *               fileName:
 *                 type: string
 *               contentType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Upload URL generated
 */
router.post(
  "/upload-product-image",
  requireAuth,
  graphicsController.getUploadUrl.bind(graphicsController),
);

export default router;
