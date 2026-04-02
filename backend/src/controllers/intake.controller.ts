import * as Sentry from "@sentry/node";
import { Response } from "express";
import type { IntakeApplicationStatus, ErrorResponse } from "../types/api.types";
import { AuthRequest } from "../middleware/auth.middleware";
import { intakeService } from "../services/massPosting/intake.service";
import { canAccessMassPosting } from "../utils/plans";
import { teamService } from "../services/team.service";
import { handleControllerError } from "../utils/controllerHelpers";

export async function getIntakeForm(req: AuthRequest, res: Response<{ form: any } | ErrorResponse>) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const form = await intakeService.getIntakeForm(teamId);
    return res.json({ form });
  } catch (error) {
    return handleControllerError(res, "Get intake form error", error, "Failed to fetch intake form");
  }
}

export async function upsertIntakeForm(req: AuthRequest, res: Response<{ form: any } | ErrorResponse>) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const { brand_description, company_website_url, icps, company_socials, competitor_socials, completed } = req.body;

    const form = await intakeService.upsertIntakeForm(teamId, {
      brand_description,
      company_website_url,
      icps,
      company_socials,
      competitor_socials,
      completed,
    });

    return res.json({ form });
  } catch (error) {
    return handleControllerError(res, "Upsert intake form error", error, "Failed to save intake form");
  }
}

export async function submitApplication(req: AuthRequest, res: Response<{ application: any } | ErrorResponse>) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const team = await teamService.getTeamById(teamId);
    if (!canAccessMassPosting(team.plan)) {
      return res.status(403).json({ error: "Mass posting requires a Studio plan or higher" });
    }

    const { brand_description, company_website_url, icps, company_socials, competitor_socials, budget, name } = req.body;

    if (!brand_description) {
      return res.status(400).json({ error: "Brand description is required" });
    }

    const application = await intakeService.submitApplication(
      teamId,
      { brand_description, company_website_url, icps, company_socials, competitor_socials },
      budget != null ? Number(budget) : undefined,
      name,
    );

    return res.status(201).json({ application });
  } catch (error: any) {
    if (error.message?.includes("already have a pending") || error.message?.includes("already been accepted")) {
      return res.status(409).json({ error: error.message });
    }

    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to submit application" });
  }
}

export async function submitAppeal(req: AuthRequest, res: Response<{ application: any } | ErrorResponse>) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const team = await teamService.getTeamById(teamId);
    if (!canAccessMassPosting(team.plan)) {
      return res.status(403).json({ error: "Mass posting requires a Studio plan or higher" });
    }

    const { brand_description, company_website_url, icps, company_socials, competitor_socials, budget } = req.body;

    const application = await intakeService.submitAppeal(
      teamId,
      { brand_description, company_website_url, icps, company_socials, competitor_socials },
      budget != null ? Number(budget) : undefined,
    );

    return res.status(201).json({ application });
  } catch (error: any) {
    if (error.message?.includes("Can only appeal")) {
      return res.status(409).json({ error: error.message });
    }

    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to submit appeal" });
  }
}

export async function getApplicationStatus(req: AuthRequest, res: Response<IntakeApplicationStatus | ErrorResponse>) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const status = await intakeService.getApplicationStatus(teamId);
    return res.json(status);
  } catch (error) {
    return handleControllerError(res, "Get application status error", error, "Failed to fetch application status");
  }
}

export async function getLatestApplication(req: AuthRequest, res: Response<{ application: any } | ErrorResponse>) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const application = await intakeService.getLatestCampaign(teamId);
    return res.json({ application });
  } catch (error) {
    return handleControllerError(res, "Get latest application error", error, "Failed to fetch application");
  }
}
