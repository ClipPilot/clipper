import { Router } from "express";
import { faceSwapController } from "../controllers/faceSwap.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { upload } from "../config/multer";

const router = Router();

/**
 * @openapi
 * /face-swap/trim:
 *   post:
 *     summary: Trim a video to specified time range
 *     tags: [Face Swap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [video, startTime, endTime, teamId]
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *               startTime:
 *                 type: number
 *               endTime:
 *                 type: number
 *               teamId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Trimmed video uploaded to S3
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 trimmedVideoKey:
 *                   type: string
 *                 trimmedVideoUrl:
 *                   type: string
 *                 duration:
 *                   type: number
 *       400:
 *         description: Missing fields, invalid time range, or no video uploaded
 */
router.post("/trim", requireAuth, upload.single("video"), faceSwapController.trimVideo);

/**
 * @openapi
 * /face-swap/download-fixed:
 *   get:
 *     summary: Download video with timestamp normalization (authenticated)
 *     description: Re-encodes video to fix playback on strict players (VLC, QuickTime, mobile)
 *     tags: [Face Swap]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *         description: Video URL to download and normalize
 *       - in: query
 *         name: filename
 *         schema:
 *           type: string
 *         description: Output filename
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [direct, remux]
 *         description: Download mode. direct = stream from S3 (fastest), remux = copy streams without re-encoding (fast), omit = full re-encode (slowest but most compatible)
 *     responses:
 *       200:
 *         description: Normalized video file
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/download-fixed", requireAuth, faceSwapController.downloadFixed);

/**
 * @openapi
 * /face-swap/download-fixed-public:
 *   get:
 *     summary: Download video with timestamp normalization (public for shared links)
 *     description: Re-encodes video to fix playback on strict players. No auth required.
 *     tags: [Face Swap]
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *         description: Video URL to download and normalize
 *       - in: query
 *         name: filename
 *         schema:
 *           type: string
 *         description: Output filename
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [direct, remux]
 *         description: Download mode. direct = stream from S3 (fastest), remux = copy streams without re-encoding (fast), omit = full re-encode (slowest but most compatible)
 *     responses:
 *       200:
 *         description: Normalized video file
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/download-fixed-public", requireAuth, faceSwapController.downloadFixedPublic);

/**
 * @openapi
 * /face-swap/detect-faces:
 *   post:
 *     summary: Auto-detect face segments in a video
 *     description: |
 *       Uses BlazeFace ML model to detect faces in video frames.
 *       Samples at 5 fps and returns merged time segments where faces appear.
 *       Maximum video duration is 120 seconds.
 *     tags: [Face Swap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [video]
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file to analyze (max 120s)
 *     responses:
 *       200:
 *         description: Face segments detected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 segments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       start:
 *                         type: number
 *                         description: Start time in seconds
 *                       end:
 *                         type: number
 *                         description: End time in seconds
 *                 videoDuration:
 *                   type: number
 *                 segmentCount:
 *                   type: integer
 *       400:
 *         description: No video uploaded or video too long
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Face detection failed
 */
router.post("/detect-faces", requireAuth, upload.single("video"), faceSwapController.detectFaces);

/**
 * @openapi
 * /face-swap/detect-faces/upload-url:
 *   post:
 *     summary: Get presigned URL for uploading video for face detection
 *     description: Returns a presigned S3 URL for direct video upload
 *     tags: [Face Swap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileName, teamId]
 *             properties:
 *               fileName:
 *                 type: string
 *               teamId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Presigned URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 uploadUrl:
 *                   type: string
 *                 s3Key:
 *                   type: string
 */
router.post("/detect-faces/upload-url", requireAuth, faceSwapController.getDetectFacesUploadUrl);

/**
 * @openapi
 * /face-swap/detect-faces/from-s3:
 *   post:
 *     summary: Detect faces from video already uploaded to S3
 *     description: Runs face detection on a video that was uploaded via presigned URL
 *     tags: [Face Swap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [s3Key, videoDuration]
 *             properties:
 *               s3Key:
 *                 type: string
 *               videoDuration:
 *                 type: number
 *     responses:
 *       200:
 *         description: Face segments detected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 segments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       start:
 *                         type: number
 *                       end:
 *                         type: number
 *                 videoDuration:
 *                   type: number
 *                 segmentCount:
 *                   type: integer
 *       400:
 *         description: Missing fields or video too long
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Face detection failed
 */
router.post("/detect-faces/from-s3", requireAuth, faceSwapController.detectFacesFromS3);

export default router;
