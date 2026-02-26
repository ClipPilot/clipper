import { Router } from "express";
import { requireAuth, requireSeatAccess } from "../middleware/auth.middleware";
import {
  createCampaign,
  listCampaigns,
  getCampaign,
  appealCampaign,
  addVideos,
  uploadVideo,
  completeVideoUpload,
  removeVideo,
  listVideos,
  getCampaignClipIds,
  getWallet,
  createSetupIntent,
  saveCard,
  createTopUp,
  getTopUpStatus,
  getContract,
  signContract,
  startCampaign,
  endCampaign,
} from "../controllers/campaign.controller";

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Campaigns
 *   description: Campaign management for mass posting distribution
 */

// Campaign CRUD

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns:
 *   post:
 *     summary: Create a new campaign
 *     description: Creates a new campaign for the team. Optionally links to an intake form.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Campaign name
 *               intakeFormId:
 *                 type: integer
 *                 description: Optional intake form ID to link
 *               budget:
 *                 type: number
 *                 description: Campaign budget
 *     responses:
 *       201:
 *         description: Campaign created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns", requireAuth, requireSeatAccess, createCampaign);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns:
 *   get:
 *     summary: List campaigns for a team
 *     description: Returns all campaigns for the team, optionally filtered by status
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The team ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected, appeal, started, paused, completed]
 *         description: Filter by campaign status
 *     responses:
 *       200:
 *         description: List of campaigns
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaigns", requireAuth, requireSeatAccess, listCampaigns);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}:
 *   get:
 *     summary: Get campaign details
 *     description: Returns a single campaign with gate statuses
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Campaign details with gates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *                 gates:
 *                   type: object
 *                   properties:
 *                     videosReady:
 *                       type: boolean
 *                     paymentReady:
 *                       type: boolean
 *                     contractReady:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaigns/:campaignId", requireAuth, requireSeatAccess, getCampaign);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/appeal:
 *   post:
 *     summary: Appeal a rejected campaign
 *     description: Submits an appeal for a previously rejected campaign with updated form data
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brand_description:
 *                 type: string
 *               company_website_url:
 *                 type: string
 *               icps:
 *                 type: array
 *                 items:
 *                   type: object
 *               company_socials:
 *                 type: object
 *               competitor_socials:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Appeal submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Campaign is not in rejected status
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/appeal", requireAuth, requireSeatAccess, appealCampaign);

// Videos

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/videos:
 *   post:
 *     summary: Add clips from library to campaign
 *     description: Bulk-adds existing clips to the campaign video queue. Validates clip ownership.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clipIds
 *             properties:
 *               clipIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of clip IDs to add
 *     responses:
 *       201:
 *         description: Videos added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 videos:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Missing clipIds or invalid IDs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Clips not owned by team
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/videos", requireAuth, requireSeatAccess, addVideos);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/videos/upload:
 *   post:
 *     summary: Get presigned URL for custom video upload
 *     description: Creates a campaign video record and returns a presigned S3 upload URL
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - contentType
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: Original file name
 *               contentType:
 *                 type: string
 *                 description: MIME type (e.g. video/mp4)
 *     responses:
 *       200:
 *         description: Presigned upload URL and video record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 video:
 *                   type: object
 *                 uploadUrl:
 *                   type: string
 *                 s3Key:
 *                   type: string
 *       400:
 *         description: Missing fileName or contentType
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/videos/upload", requireAuth, requireSeatAccess, uploadVideo);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/videos/{videoId}/complete:
 *   post:
 *     summary: Mark custom video upload as complete
 *     description: Confirms that a custom video has been uploaded to S3 and re-checks the video gate
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Upload marked complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 video:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Video not found
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/videos/:videoId/complete", requireAuth, requireSeatAccess, completeVideoUpload);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/videos/{videoId}:
 *   delete:
 *     summary: Remove a video from the campaign
 *     description: Deletes a campaign video record and cleans up S3 if it was a custom upload
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Video removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Video not found
 *       500:
 *         description: Server error
 */
router.delete("/teams/:teamId/campaigns/:campaignId/videos/:videoId", requireAuth, requireSeatAccess, removeVideo);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/videos:
 *   get:
 *     summary: List campaign videos
 *     description: Returns all videos in the campaign queue with presigned URLs
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of campaign videos with URLs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 videos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       campaignId:
 *                         type: integer
 *                       clipId:
 *                         type: integer
 *                         nullable: true
 *                       customVideoName:
 *                         type: string
 *                         nullable: true
 *                       clipTitle:
 *                         type: string
 *                         nullable: true
 *                       durationSeconds:
 *                         type: number
 *                         nullable: true
 *                       videoUrl:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaigns/:campaignId/videos", requireAuth, requireSeatAccess, listVideos);

// Campaign clip IDs (for library "already added" checks)

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaign-clip-ids:
 *   get:
 *     summary: Get all clip IDs in campaigns
 *     description: Returns all unique clip IDs across all campaigns for the team
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Array of clip IDs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clipIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaign-clip-ids", requireAuth, requireSeatAccess, getCampaignClipIds);

// Wallet

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/wallet:
 *   get:
 *     summary: Get campaign wallet
 *     description: Returns the campaign wallet balance and top-up history
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Wallet details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wallet:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     campaignId:
 *                       type: integer
 *                     balanceCents:
 *                       type: integer
 *                     totalDepositedCents:
 *                       type: integer
 *                     totalSpentCents:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaigns/:campaignId/wallet", requireAuth, requireSeatAccess, getWallet);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/wallet/setup-intent:
 *   post:
 *     summary: Create a Stripe SetupIntent for saving a card
 *     description: Creates a Stripe SetupIntent so the user can securely save a payment method to the campaign wallet without an immediate charge.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Stripe SetupIntent client secret
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientSecret:
 *                   type: string
 *                   description: Stripe SetupIntent client_secret for use with Stripe.js
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/wallet/setup-intent", requireAuth, requireSeatAccess, createSetupIntent);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/wallet/save-card:
 *   post:
 *     summary: Save a payment method to the campaign wallet
 *     description: Stores the Stripe PaymentMethod ID (returned after SetupIntent confirmation) on the campaign wallet for future charges.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethodId
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *                 description: Stripe PaymentMethod ID (e.g. pm_xxx)
 *     responses:
 *       200:
 *         description: Card saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 saved:
 *                   type: boolean
 *                 card:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     brand:
 *                       type: string
 *                     last4:
 *                       type: string
 *                     exp_month:
 *                       type: integer
 *                     exp_year:
 *                       type: integer
 *       400:
 *         description: Missing or invalid paymentMethodId
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/wallet/save-card", requireAuth, requireSeatAccess, saveCard);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/wallet/top-up:
 *   post:
 *     summary: Create a wallet top-up payment
 *     description: Creates a Stripe PaymentIntent for topping up the campaign wallet
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amountCents
 *             properties:
 *               amountCents:
 *                 type: integer
 *                 description: Amount in cents to top up
 *                 minimum: 100
 *     responses:
 *       200:
 *         description: Stripe PaymentIntent created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientSecret:
 *                   type: string
 *                 paymentIntentId:
 *                   type: string
 *       400:
 *         description: Invalid amount
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/wallet/top-up", requireAuth, requireSeatAccess, createTopUp);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/wallet/top-up/{piId}/status:
 *   get:
 *     summary: Poll top-up credit status
 *     description: Checks whether a Stripe PaymentIntent has been credited to the campaign wallet
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: piId
 *         required: true
 *         schema:
 *           type: string
 *         description: Stripe PaymentIntent ID
 *     responses:
 *       200:
 *         description: Credit status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 credited:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaigns/:campaignId/wallet/top-up/:piId/status", requireAuth, requireSeatAccess, getTopUpStatus);

// Contract

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/contract:
 *   get:
 *     summary: Get campaign contract
 *     description: Returns the contract for the campaign with a presigned PDF URL
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contract details with PDF URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contract:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     campaignId:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       enum: [pending, signed, voided]
 *                     pdfUrl:
 *                       type: string
 *                       nullable: true
 *                     signedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Contract not found
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaigns/:campaignId/contract", requireAuth, requireSeatAccess, getContract);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/contract/sign:
 *   post:
 *     summary: Sign the campaign contract
 *     description: Signs the contract with a legal name and signature image. Stamps the signature onto the PDF and emails a copy.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - legalName
 *               - signatureDataUrl
 *             properties:
 *               legalName:
 *                 type: string
 *                 description: Full legal name of the signer
 *               signatureDataUrl:
 *                 type: string
 *                 description: Base64 data URL of the signature image (PNG)
 *     responses:
 *       200:
 *         description: Contract signed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contract:
 *                   type: object
 *       400:
 *         description: Missing legalName or signatureDataUrl
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Contract not found
 *       409:
 *         description: Contract already signed
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/contract/sign", requireAuth, requireSeatAccess, signContract);

// Start

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/start:
 *   post:
 *     summary: Start a campaign
 *     description: Starts the campaign after validating all three gates (videos, payment, contract). Creates a Google Drive folder.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Campaign started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Not all gates are ready
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 *       409:
 *         description: Campaign is not in accepted status
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/start", requireAuth, requireSeatAccess, startCampaign);

// End

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/end:
 *   post:
 *     summary: End a campaign
 *     description: Ends a started or paused campaign by setting its status to completed
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Campaign ended
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campaign:
 *                   type: object
 *       400:
 *         description: Campaign is not in started or paused status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/end", requireAuth, requireSeatAccess, endCampaign);

export default router;
