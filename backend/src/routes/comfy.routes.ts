import { Router } from "express";
import multer from "multer";
import { comfyController } from "../controllers/comfy.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { faceSwapUpload } from "../config/multer";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 50 * 1024 * 1024, // 50MB max for field values (needed for base64 encoded images)
  },
});

const optionalMulter = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
]);

const conditionalMulter = (req: any, res: any, next: any) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return optionalMulter(req, res, next);
  }
  next();
};

/**
 * @openapi
 * /comfy/ugc-upload-urls:
 *   post:
 *     summary: Get presigned S3 upload URLs for UGC assets
 *     tags:
 *       - ComfyUI
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
 *               - files
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID
 *               files:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fileName:
 *                       type: string
 *                     contentType:
 *                       type: string
 *     responses:
 *       200:
 *         description: Presigned upload URLs generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 urls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       uploadUrl:
 *                         type: string
 *                         format: uri
 *                       key:
 *                         type: string
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Failed to generate upload URLs
 */
router.post(
  "/ugc-upload-urls",
  requireAuth,
  comfyController.getUGCUploadUrls.bind(comfyController)
);

/**
 * @openapi
 * /comfy/ugc-face-swap:
 *   post:
 *     summary: Create a UGC face swap job
 *     description: Accepts either multipart/form-data with image/video files or JSON with S3 keys
 *     tags:
 *       - ComfyUI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               teamId:
 *                 type: integer
 *               image:
 *                 type: string
 *                 format: binary
 *               video:
 *                 type: string
 *                 format: binary
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               teamId:
 *                 type: integer
 *               imageKey:
 *                 type: string
 *               videoKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Face swap job created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Failed to create face swap job
 */
router.post(
  "/ugc-face-swap",
  requireAuth,
  conditionalMulter,
  comfyController.createUGCFaceSwapJob.bind(comfyController)
);

/**
 * @openapi
 * /comfy/ugc-face-swap-upload:
 *   post:
 *     summary: Create a UGC face swap job with direct file upload
 *     description: Uploads video and face images directly, then queues a face swap job
 *     tags:
 *       - ComfyUI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - video
 *               - images
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: The source video file
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Up to 10 face image files
 *     responses:
 *       200:
 *         description: Face swap job created with uploaded files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Failed to create face swap job
 */
router.post(
  "/ugc-face-swap-upload",
  requireAuth,
  faceSwapUpload.fields([
    { name: "video", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
  comfyController.createUGCFaceSwapWithUpload.bind(comfyController)
);

/**
 * @openapi
 * /comfy/jobs/{jobId}:
 *   get:
 *     summary: Get job status
 *     tags:
 *       - ComfyUI
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job details
 *       404:
 *         description: Job not found
 */
router.get(
  "/jobs/:jobId",
  requireAuth,
  comfyController.getJobStatus.bind(comfyController)
);

/**
 * @openapi
 * /comfy/team/{teamId}/jobs:
 *   get:
 *     summary: Get all jobs for a team
 *     tags:
 *       - ComfyUI
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of jobs
 */
router.get(
  "/team/:teamId/jobs",
  requireAuth,
  comfyController.getTeamJobs.bind(comfyController)
);

/**
 * @openapi
 * /comfy/jobs/{jobId}:
 *   delete:
 *     summary: Delete a job
 *     tags:
 *       - ComfyUI
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job deleted
 *       404:
 *         description: Job not found
 */
router.delete(
  "/jobs/:jobId",
  requireAuth,
  comfyController.deleteJob.bind(comfyController)
);

/**
 * @openapi
 * /comfy/jobs/{jobId}:
 *   patch:
 *     summary: Update a job (e.g., title)
 *     tags:
 *       - ComfyUI
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job updated
 *       404:
 *         description: Job not found
 */
router.patch(
  "/jobs/:jobId",
  requireAuth,
  comfyController.updateJob.bind(comfyController)
);

/**
 * @openapi
 * /comfy/saved-faces/{teamId}:
 *   get:
 *     summary: Get all saved faces for a team
 *     tags:
 *       - Saved Faces
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID to get saved faces for
 *     responses:
 *       200:
 *         description: List of saved faces
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 faces:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       imageUrl:
 *                         type: string
 *                         format: uri
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Team ID required
 *       500:
 *         description: Failed to get saved faces
 */
router.get(
  "/saved-faces/:teamId",
  requireAuth,
  comfyController.getSavedFaces.bind(comfyController)
);

/**
 * @openapi
 * /comfy/saved-faces:
 *   post:
 *     summary: Save a new face for a team
 *     tags:
 *       - Saved Faces
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - name
 *               - image
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID to save the face for
 *               name:
 *                 type: string
 *                 description: Display name for the saved face
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: The face image file
 *     responses:
 *       201:
 *         description: Face saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 face:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *                       format: uri
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Missing required fields (teamId, name, or image)
 *       500:
 *         description: Failed to save face
 */
router.post(
  "/saved-faces",
  requireAuth,
  upload.single("image"),
  comfyController.saveFace.bind(comfyController)
);

/**
 * @openapi
 * /comfy/saved-faces/{id}:
 *   delete:
 *     summary: Delete a saved face
 *     tags:
 *       - Saved Faces
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The saved face ID to delete
 *     responses:
 *       200:
 *         description: Face deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Face deleted successfully
 *       400:
 *         description: Face ID required
 *       404:
 *         description: Face not found
 *       500:
 *         description: Failed to delete face
 */
router.delete(
  "/saved-faces/:id",
  requireAuth,
  comfyController.deleteSavedFace.bind(comfyController)
);

/**
 * @openapi
 * /comfy/generate-pose:
 *   post:
 *     summary: Generate a posed image using FAL AI
 *     description: Takes a video frame and character face, generates an image with the face in the video's pose
 *     tags:
 *       - Pose Generation
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - teamId
 *               - videoFrameBase64
 *             properties:
 *               teamId:
 *                 type: integer
 *                 description: The team ID
 *               videoFrameBase64:
 *                 type: string
 *                 description: Base64 encoded video frame image
 *               characterImageKey:
 *                 type: string
 *                 description: S3 key of the character image (for saved faces)
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Character face image file (alternative to characterImageKey)
 *     responses:
 *       200:
 *         description: Pose generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imageUrl:
 *                   type: string
 *                   format: uri
 *                   description: URL of the generated pose image
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Plan required or insufficient access
 *       500:
 *         description: Failed to generate pose
 */
router.post(
  "/generate-pose",
  requireAuth,
  upload.single("image"),
  comfyController.generatePose.bind(comfyController)
);

export default router;
