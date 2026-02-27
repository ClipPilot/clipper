import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { userService } from "../services/user.service";
import { teamService } from "../services/team.service";

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
  fallbackMessage: string
) {
  console.error(`${label}:`, error);
  Sentry.captureException(error);

  if (error.message?.includes("not found")) {
    return res.status(404).json({ error: error.message });
  }
  if (error.message?.includes("already being tracked")) {
    return res.status(409).json({ error: error.message });
  }
  return res.status(500).json({ error: fallbackMessage });
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
