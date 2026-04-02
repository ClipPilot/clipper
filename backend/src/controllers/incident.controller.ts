import { Request, Response } from "express";
import type { ErrorResponse } from "../types/api.types";
import { incidentService } from "../services/incident.service";
import { AdminRequest } from "../middleware/admin.middleware";
import { handleControllerError } from "../utils/controllerHelpers";

export async function getActiveIncidents(req: Request, res: Response<{ incidents: Record<string, any>[] } | ErrorResponse>) {
  try {
    const incidents = await incidentService.getActiveIncidents();
    return res.json({ incidents });
  } catch (error) {
    return handleControllerError(res, "Get active incidents error", error, "Failed to fetch incidents");
  }
}

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
    return handleControllerError(res, "Get all incidents error", error, "Failed to fetch incidents");
  }
}

export async function createIncident(req: AdminRequest, res: Response<{ incident: Record<string, any> } | ErrorResponse>) {
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
    return handleControllerError(res, "Create incident error", error, "Failed to create incident");
  }
}

export async function updateIncident(req: AdminRequest, res: Response<{ incident: Record<string, any> } | ErrorResponse>) {
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
    if (error instanceof Error && error.message === "Incident not found") {
      return res.status(404).json({ error: "Incident not found" });
    }

    return handleControllerError(res, "Update incident error", error, "Failed to update incident");
  }
}

export async function addIncidentUpdate(req: AdminRequest, res: Response<{ incident: Record<string, any> } | ErrorResponse>) {
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
    if (error instanceof Error && error.message === "Incident not found") {
      return res.status(404).json({ error: "Incident not found" });
    }

    return handleControllerError(res, "Add incident update error", error, "Failed to add incident update");
  }
}

export async function deleteIncident(req: AdminRequest, res: Response<{ success: true; message: string } | ErrorResponse>) {
  try {
    const id = parseInt(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid incident ID" });
    }

    await incidentService.deleteIncident(id);
    return res.json({ success: true, message: "Incident deleted" });
  } catch (error) {
    return handleControllerError(res, "Delete incident error", error, "Failed to delete incident");
  }
}
