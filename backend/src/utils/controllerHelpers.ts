import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { userService } from "../services/user.service";
import { teamService } from "../services/team.service";
import { sanitizeErrorForFrontend } from "./errorSanitizer";

export function requireUser(req: AuthRequest, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.user.id;
}

export function parseId(value: string): number | null {
  const n = parseInt(value);
  return isNaN(n) ? null : n;
}

export function parseDateQuery(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? undefined : d;
}

export function handleControllerError(
  res: Response,
  label: string,
  error: any,
  fallbackMessage: string,
  statusCode: number = 500
) {
  console.error(`${label}:`, error);
  Sentry.captureException(error);
  return res
    .status(statusCode)
    .json({ error: sanitizeErrorForFrontend(error, fallbackMessage) });
}

export async function verifyTeamAccessOrFail(
  req: AuthRequest,
  teamId: number,
  res: Response,
): Promise<{ id: number } | null> {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const user = await userService.getUserBySupabaseUid(req.user.id);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return null;
  }
  const hasAccess = await teamService.verifyTeamAccess(teamId, user.id);
  if (!hasAccess) {
    res.status(403).json({ error: "Access denied to this team" });
    return null;
  }
  return user;
}

export async function requireTeamOwner(
  req: AuthRequest,
  teamId: number,
  res: Response,
): Promise<{ id: number } | null> {
  const user = await verifyTeamAccessOrFail(req, teamId, res);
  if (!user) return null;

  const role = await teamService.getUserTeamRole(teamId, user.id);
  if (role !== "owner") {
    res.status(403).json({ error: "Only team owners can manage billing" });
    return null;
  }
  return user;
}

export async function requirePlanAccess(
  teamId: number,
  res: Response,
  checkFn: (teamId: number) => Promise<boolean>,
  errorMessage: string,
): Promise<boolean> {
  const hasAccess = await checkFn(teamId);
  if (!hasAccess) {
    res.status(403).json({ error: errorMessage, code: "PLAN_REQUIRED" });
    return false;
  }
  return true;
}
