import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAdminAuth } from "../middleware/admin.middleware";
import {
  getActiveIncidents,
  getAllIncidents,
  createIncident,
  updateIncident,
  addIncidentUpdate,
  deleteIncident,
} from "../controllers/incident.controller";

const router = Router();

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Public Endpoints
 */

/**
 * @openapi
 * /api/incidents/active:
 *   get:
 *     summary: Get active and recently resolved incidents
 *     description: Returns all non-resolved incidents plus incidents resolved within the last 7 days. Used by the public status page.
 *     tags: [Incidents]
 *     responses:
 *       200:
 *         description: Successfully retrieved active incidents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 incidents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [investigating, identified, monitoring, resolved]
 *                       affected_services:
 *                         type: array
 *                         items:
 *                           type: string
 *                       updates:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                             message:
 *                               type: string
 *                             timestamp:
 *                               type: string
 *                               format: date-time
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       resolved_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 */
router.get("/active", publicLimiter, getActiveIncidents);

/**
 * Admin Endpoints
 */

/**
 * @openapi
 * /api/incidents/admin:
 *   get:
 *     summary: Get all incidents with optional filters (Admin)
 *     tags: [Admin - Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [investigating, identified, monitoring, resolved]
 *         description: Filter by status
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
 *         description: Successfully retrieved incidents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 incidents:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 */
router.get("/admin", requireAdminAuth, adminLimiter, getAllIncidents);

/**
 * @openapi
 * /api/incidents/admin:
 *   post:
 *     summary: Create a new incident (Admin)
 *     tags: [Admin - Incidents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - affected_services
 *               - message
 *             properties:
 *               title:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [investigating, identified, monitoring, resolved]
 *                 default: investigating
 *               affected_services:
 *                 type: array
 *                 items:
 *                   type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Incident created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 incident:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [investigating, identified, monitoring, resolved]
 *                     affected_services:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Validation error
 */
router.post("/admin", requireAdminAuth, adminLimiter, createIncident);

/**
 * @openapi
 * /api/incidents/admin/{id}:
 *   patch:
 *     summary: Update incident metadata (Admin)
 *     tags: [Admin - Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               title:
 *                 type: string
 *               affected_services:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Incident updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 incident:
 *                   type: object
 *       404:
 *         description: Incident not found
 */
router.patch("/admin/:id", requireAdminAuth, adminLimiter, updateIncident);

/**
 * @openapi
 * /api/incidents/admin/{id}/update:
 *   post:
 *     summary: Add a status update to an incident (Admin)
 *     description: Appends a new status update to the incident timeline and updates the top-level status.
 *     tags: [Admin - Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - status
 *               - message
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [investigating, identified, monitoring, resolved]
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Update added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 incident:
 *                   type: object
 *       404:
 *         description: Incident not found
 */
router.post("/admin/:id/update", requireAdminAuth, adminLimiter, addIncidentUpdate);

/**
 * @openapi
 * /api/incidents/admin/{id}:
 *   delete:
 *     summary: Delete an incident (Admin)
 *     tags: [Admin - Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Incident deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.delete("/admin/:id", requireAdminAuth, adminLimiter, deleteIncident);

export default router;
