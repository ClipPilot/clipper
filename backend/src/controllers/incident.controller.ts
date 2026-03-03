import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import { incidentService } from "../services/incident.service";
import { AdminRequest } from "../middleware/admin.middleware";

/**
 * Public — active incidents for status page
 */
export async function getActiveIncidents(req: Request, res: Response) {
  try {
    const incidents = await incidentService.getActiveIncidents();
    return res.json({ incidents });
  } catch (error) {
    console.error("Get active incidents error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch incidents" });
  }
}

/**
 * Admin — list all incidents
 */
export async function getAllIncidents(req: AdminRequest, res: Response) {
  try {
    const { status, limit, offset } = req.query;

    const result = await incidentService.getAllIncidents({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error("Get all incidents error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch incidents" });
  }
}

/**
 * Admin — create incident
 */
export async function createIncident(req: AdminRequest, res: Response) {
  try {
    const { title, status, affected_services, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    if (!affected_services || !Array.isArray(affected_services) || affected_services.length === 0) {
      return res.status(400).json({ error: "At least one affected service is required" });
    }

    const adminEmail = req.admin?.email;
    if (!adminEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const incident = await incidentService.createIncident({
      title,
      status,
      affected_services,
      message,
      created_by_admin_email: adminEmail,
    });

    return res.status(201).json({ incident });
  } catch (error) {
    console.error("Create incident error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create incident" });
  }
}

/**
 * Admin — update incident metadata
 */
export async function updateIncident(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const { title, affected_services } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid incident ID" });
    }

    const incident = await incidentService.updateIncident(id, {
      title,
      affected_services,
    });

    return res.json({ incident });
  } catch (error) {
    console.error("Update incident error:", error);
    Sentry.captureException(error);

    if (error instanceof Error && error.message === "Incident not found") {
      return res.status(404).json({ error: "Incident not found" });
    }

    return res.status(500).json({ error: "Failed to update incident" });
  }
}

/**
 * Admin — add status update to incident
 */
export async function addIncidentUpdate(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const { status, message } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid incident ID" });
    }

    if (!status || !message) {
      return res.status(400).json({ error: "Status and message are required" });
    }

    const validStatuses = ["investigating", "identified", "monitoring", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const incident = await incidentService.addUpdate(id, { status, message });

    return res.json({ incident });
  } catch (error) {
    console.error("Add incident update error:", error);
    Sentry.captureException(error);

    if (error instanceof Error && error.message === "Incident not found") {
      return res.status(404).json({ error: "Incident not found" });
    }

    return res.status(500).json({ error: "Failed to add incident update" });
  }
}

/**
 * Admin — delete incident
 */
export async function deleteIncident(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid incident ID" });
    }

    await incidentService.deleteIncident(id);
    return res.json({ success: true, message: "Incident deleted" });
  } catch (error) {
    console.error("Delete incident error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to delete incident" });
  }
}
