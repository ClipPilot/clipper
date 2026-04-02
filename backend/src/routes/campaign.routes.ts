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
  fundWithCredits,
  getMasterAgreement,
  signMasterAgreement,
  startCampaign,
  endCampaign,
  getCpmBillingBreakdown,
} from "../controllers/campaign.controller";

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Campaigns
 *   description: Campaign management for mass posting distribution
 */

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
 *               budget:
 *                 type: number
 *     responses:
 *       201:
 *         description: Campaign created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - campaign
 *               properties:
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Campaign already exists
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected, appeal, started, paused, completed]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of campaigns
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - campaigns
 *                 - total
 *                 - pagination
 *               properties:
 *                 campaigns:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Campaign'
 *                 total:
 *                   type: integer
 *                 pagination:
 *                   type: object
 *                   required:
 *                     - limit
 *                     - offset
 *                     - total
 *                     - hasMore
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
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
 *               required:
 *                 - campaign
 *                 - gates
 *               properties:
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *                 gates:
 *                   $ref: '#/components/schemas/CampaignGates'
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
 *               required:
 *                 - campaign
 *               properties:
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
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
 *     responses:
 *       201:
 *         description: Videos added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - videos
 *               properties:
 *                 videos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CampaignVideo'
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
 *               contentType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Presigned upload URL and video record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - video
 *                 - uploadUrl
 *                 - s3Key
 *               properties:
 *                 video:
 *                   $ref: '#/components/schemas/CampaignVideo'
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
 *               required:
 *                 - video
 *               properties:
 *                 video:
 *                   $ref: '#/components/schemas/CampaignVideo'
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
 *               required:
 *                 - success
 *               properties:
 *                 success:
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
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, title, publish_status, post_count]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [published, unpublished, queued]
 *     responses:
 *       200:
 *         description: List of campaign videos with URLs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - videos
 *                 - pagination
 *               properties:
 *                 videos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CampaignVideo'
 *                 pagination:
 *                   type: object
 *                   required:
 *                     - page
 *                     - pageSize
 *                     - totalVideos
 *                     - totalPages
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     totalVideos:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaigns/:campaignId/videos", requireAuth, requireSeatAccess, listVideos);

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
 *         description: Clip IDs and campaign-to-clip mapping
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - clipIds
 *                 - campaignClipMap
 *               properties:
 *                 clipIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 campaignClipMap:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaign-clip-ids", requireAuth, requireSeatAccess, getCampaignClipIds);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/wallet:
 *   get:
 *     summary: Get campaign wallet
 *     description: Returns the campaign wallet balance and payment method
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
 *               required:
 *                 - wallet
 *                 - card
 *               properties:
 *                 wallet:
 *                   $ref: '#/components/schemas/CampaignWallet'
 *                 card:
 *                   nullable: true
 *                   allOf:
 *                     - $ref: '#/components/schemas/CampaignPaymentMethod'
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
 *               required:
 *                 - clientSecret
 *               properties:
 *                 clientSecret:
 *                   type: string
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
 *     description: Stores the Stripe PaymentMethod ID on the campaign wallet for future charges.
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
 *     responses:
 *       200:
 *         description: Card saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - saved
 *                 - card
 *               properties:
 *                 saved:
 *                   type: boolean
 *                 card:
 *                   nullable: true
 *                   allOf:
 *                     - $ref: '#/components/schemas/CampaignPaymentMethod'
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
 *                 minimum: 100
 *     responses:
 *       200:
 *         description: Stripe PaymentIntent created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - confirmed
 *                 - paymentIntentId
 *                 - clientSecret
 *               properties:
 *                 confirmed:
 *                   type: boolean
 *                 processing:
 *                   type: boolean
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
 *     responses:
 *       200:
 *         description: Credit status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - credited
 *               properties:
 *                 credited:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaigns/:campaignId/wallet/top-up/:piId/status", requireAuth, requireSeatAccess, getTopUpStatus);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/wallet/fund-with-credits:
 *   post:
 *     summary: Fund campaign wallet with Cuttr credits
 *     description: Converts Cuttr credits into campaign wallet dollars at the rate of 1 credit = $3.50.
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
 *               - creditCount
 *             properties:
 *               creditCount:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Credits applied to wallet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - confirmed
 *                 - balanceCents
 *                 - creditsUsed
 *                 - amountCents
 *               properties:
 *                 confirmed:
 *                   type: boolean
 *                 balanceCents:
 *                   type: integer
 *                 creditsUsed:
 *                   type: integer
 *                 amountCents:
 *                   type: integer
 *       400:
 *         description: Invalid credit count or insufficient credits
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/campaigns/:campaignId/wallet/fund-with-credits", requireAuth, requireSeatAccess, fundWithCredits);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/master-agreement:
 *   get:
 *     summary: Get or generate master agreement
 *     description: Returns the team's master agreement. If none exists, generates an unsigned PDF and returns it.
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
 *         description: Master agreement details with PDF URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - agreement
 *               properties:
 *                 agreement:
 *                   $ref: '#/components/schemas/MasterAgreement'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/master-agreement", requireAuth, requireSeatAccess, getMasterAgreement);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/master-agreement/sign:
 *   post:
 *     summary: Sign the master agreement
 *     description: Signs the master agreement with entity info and signature image.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
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
 *               - legalEntityName
 *               - signerName
 *               - signerTitle
 *               - signerEmail
 *               - signatureDataUrl
 *             properties:
 *               legalEntityName:
 *                 type: string
 *               signerName:
 *                 type: string
 *               signerTitle:
 *                 type: string
 *               signerEmail:
 *                 type: string
 *               signatureDataUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Agreement signed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - agreement
 *               properties:
 *                 agreement:
 *                   $ref: '#/components/schemas/MasterAgreement'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Agreement already signed
 *       500:
 *         description: Server error
 */
router.post("/teams/:teamId/master-agreement/sign", requireAuth, requireSeatAccess, signMasterAgreement);

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/start:
 *   post:
 *     summary: Start a campaign
 *     description: Starts the campaign after validating all three gates (videos, payment, contract).
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
 *               required:
 *                 - campaign
 *               properties:
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
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
 *               required:
 *                 - campaign
 *               properties:
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
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

/**
 * @openapi
 * /api/campaigns/teams/{teamId}/campaigns/{campaignId}/billing:
 *   get:
 *     summary: Get CPM billing breakdown
 *     description: Returns daily CPM charges with per-post view breakdowns, wallet spend, and card charges
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
 *         description: Billing breakdown
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CpmBillingBreakdown'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/teams/:teamId/campaigns/:campaignId/billing", requireAuth, requireSeatAccess, getCpmBillingBreakdown);

export default router;
