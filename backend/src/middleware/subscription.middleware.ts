import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { db } from "../db";
import {
  subscriptions,
  teams,
  usageStats,
} from "@clipper/shared-db/src/schema";
import { eq, and } from "drizzle-orm";
import { getClipsLimitForPlan } from "../config/stripe.config";

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

export interface UsageInfo {
  clipsCreated: number;
  limit: number;
  remaining: number;
  resetsDate: Date;
  plan: string;
}

// Helper function to get team usage info
export async function getTeamUsage(teamId: number): Promise<UsageInfo | null> {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) return null;

  const [usage] = await db
    .select()
    .from(usageStats)
    .where(eq(usageStats.team_id, teamId))
    .limit(1);

  if (!usage) return null;

  return {
    clipsCreated: usage.clips_created,
    limit: usage.limit,
    remaining: Math.max(0, usage.limit - usage.clips_created),
    resetsDate: usage.resets_date,
    plan: team.plan || "free",
  };
}

// Middleware to check if team has remaining clip quota
export async function requireClipQuota(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const teamId = parseInt(req.params.teamId || req.body.teamId);

    if (!teamId || isNaN(teamId)) {
      return res.status(400).json({ error: "Team ID is required" });
    }

    const usage = await getTeamUsage(teamId);

    if (!usage) {
      return res.status(404).json({ error: "Team or usage stats not found" });
    }

    if (usage.remaining <= 0) {
      return res.status(403).json({
        error: "Clip limit reached",
        code: "CLIP_LIMIT_REACHED",
        usage: {
          clipsCreated: usage.clipsCreated,
          limit: usage.limit,
          remaining: 0,
          resetsDate: usage.resetsDate,
          plan: usage.plan,
        },
      });
    }

    // Attach usage info to request for downstream use
    (req as any).teamUsage = usage;

    next();
  } catch (err) {
    console.error("Usage check error:", err);
    return res.status(500).json({ error: "Failed to verify usage quota" });
  }
}

// Middleware to check subscription status and get usage info (non-blocking)
export async function checkSubscriptionAndUsage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const teamId = parseInt(req.params.teamId || req.body.teamId);

    if (!teamId || isNaN(teamId)) {
      return next();
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return next();
    }

    // Get subscription status
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.team_id, teamId))
      .limit(1);

    // Get usage info
    const usage = await getTeamUsage(teamId);

    // Attach info to request
    (req as any).teamSubscription = subscription || null;
    (req as any).teamUsage = usage;
    (req as any).teamPlan = team.plan || "free";

    next();
  } catch (err) {
    console.error("Subscription/usage check error:", err);
    next();
  }
}

// Helper function to increment clip usage for a team
export async function incrementClipUsage(teamId: number): Promise<boolean> {
  try {
    const [usage] = await db
      .select()
      .from(usageStats)
      .where(eq(usageStats.team_id, teamId))
      .limit(1);

    if (!usage) return false;

    if (usage.clips_created >= usage.limit) {
      return false;
    }

    await db
      .update(usageStats)
      .set({
        clips_created: usage.clips_created + 1,
        updated_at: new Date(),
      })
      .where(eq(usageStats.team_id, teamId));

    return true;
  } catch (err) {
    console.error("Failed to increment clip usage:", err);
    return false;
  }
}
