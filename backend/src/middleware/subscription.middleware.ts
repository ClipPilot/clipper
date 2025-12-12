import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { db } from "../db";
import { subscriptions, teams, teamMembers } from "@clipper/shared-db/src/schema";
import { eq, and } from "drizzle-orm";

export async function requireActiveSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const teamId = parseInt(req.params.teamId || req.body.teamId);

    if (!teamId || isNaN(teamId)) {
      return res.status(400).json({ error: "Team ID is required" });
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    if (team.type === "personal") {
      return next();
    }

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.team_id, teamId),
          eq(subscriptions.status, "active")
        )
      )
      .limit(1);

    if (!subscription) {
      return res.status(403).json({
        error: "Active subscription required for business teams",
        requiresSubscription: true,
      });
    }

    next();
  } catch (err) {
    console.error("Subscription check error:", err);
    return res.status(500).json({ error: "Failed to verify subscription" });
  }
}

export async function requireSubscriptionForAction(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const teamId = parseInt(req.params.teamId);

    if (!teamId || isNaN(teamId)) {
      return res.status(400).json({ error: "Team ID is required" });
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    if (team.type !== "personal") {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.team_id, teamId),
            eq(subscriptions.status, "active")
          )
        )
        .limit(1);

      if (!subscription) {
        return res.status(403).json({
          error: "Active subscription required for this action on business teams",
          requiresSubscription: true,
        });
      }
    }

    next();
  } catch (err) {
    console.error("Subscription check error:", err);
    return res.status(500).json({ error: "Failed to verify subscription" });
  }
}
