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
 *             required:
 *               - teamId
 *               - prompt
 *               - graphicType
 *               - aspectRatio
 *             properties:
 *               teamId:
 *                 type: integer
 *               prompt:
 *                 type: string
 *               graphicType:
 *                 type: string
 *                 enum: [instagram-ad, facebook-ad, product-showcase, banner-display-ad, custom]
 *               aspectRatio:
 *                 type: string
 *                 enum: ["1:1", "9:16", "16:9", "4:5", "3:4", "2:3"]
 *               mode:
 *                 type: string
 *                 enum: [variations, carousel]
 *                 default: variations
 *               stylePreset:
 *                 type: string
 *                 enum: [tile-ad, collage, photoshoot, flat-lay, ugc, minimalist]
 *                 default: tile-ad
 *               productImageKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 4
 *     responses:
 *       200:
 *         description: Graphics generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GenerateGraphicsResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GraphicsUploadUrlResponse'
 */
router.post(
  "/upload-product-image",
  requireAuth,
  graphicsController.getUploadUrl.bind(graphicsController),
);

export default router;
