import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AdminRequest } from "../middleware/admin.middleware";
import { intakeService } from "../services/massPosting/intake.service";

export async function getAllApplications(req: AdminRequest, res: Response) {
  try {
    const { status, limit, offset } = req.query;

    const result = await intakeService.getAllApplications({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error("Get all applications error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch applications" });
  }
}

export async function getApplication(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.applicationId);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid application ID" });
    }

    const application = await intakeService.getApplicationById(id);
    return res.json({ application });
  } catch (error: any) {
    console.error("Get application error:", error);

    if (error.message === "Application not found") {
      return res.status(404).json({ error: "Application not found" });
    }

    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch application" });
  }
}

export async function approveApplication(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.applicationId);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid application ID" });
    }

    const { adminNotes } = req.body;
    const application = await intakeService.approveApplication(id, adminNotes);

    return res.json({ application });
  } catch (error: any) {
    console.error("Approve application error:", error);

    if (error.message === "Application not found") {
      return res.status(404).json({ error: "Application not found" });
    }

    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to approve application" });
  }
}

export async function rejectApplication(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.applicationId);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid application ID" });
    }

    const { rejectionReason, adminNotes } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const application = await intakeService.rejectApplication(id, rejectionReason, adminNotes);
    return res.json({ application });
  } catch (error: any) {
    console.error("Reject application error:", error);

    if (error.message === "Application not found") {
      return res.status(404).json({ error: "Application not found" });
    }

    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to reject application" });
  }
}

export async function updateApplicationCPM(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.applicationId);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid application ID" });
    }

    const { quotedCpm, videoMinimum } = req.body;

    if (!quotedCpm) {
      return res.status(400).json({ error: "quotedCpm is required" });
    }

    const application = await intakeService.updateApplicationCPM(
      id,
      String(quotedCpm),
      videoMinimum != null ? Number(videoMinimum) : undefined,
    );

    return res.json({ application });
  } catch (error: any) {
    console.error("Update application CPM error:", error);

    if (error.message === "Application not found") {
      return res.status(404).json({ error: "Application not found" });
    }

    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to update application" });
  }
}

export async function retryDriveFolder(req: AdminRequest, res: Response) {
  try {
    const id = parseInt(req.params.applicationId);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid application ID" });
    }

    const application = await intakeService.retryDriveFolder(id);
    return res.json({ application });
  } catch (error: any) {
    console.error("Retry drive folder error:", error);

    if (error.message === "Application not found") {
      return res.status(404).json({ error: "Application not found" });
    }
    if (error.message?.includes("only retry") || error.message?.includes("already exists")) {
      return res.status(409).json({ error: error.message });
    }

    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create Drive folder" });
  }
}
