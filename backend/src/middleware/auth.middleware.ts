import { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import crypto from "crypto";
import { authService } from "../services/auth.service";
import { db } from "../db";
import {
  users,
  APIKeys,
  apiBillingAccounts,
} from "@clipper/shared-db/src/schema";
import { eq, and } from "drizzle-orm";
import { teamService } from "../services/team.service";
import { getRedisClient } from "../services/redis.service";

const API_RATE_LIMIT = 60;

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    dbUserId: number;
  };
  seatCheckPassed?: boolean;
}

export interface ApiKeyRequest extends Request {
  apiKey?: {
    id: number;
    teamId: number;
    userId: number;
    name: string;
  };
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    // Allow internal service-to-service calls (agent-service → backend)
    // Scoped to specific route prefixes only
    const internalKey = req.headers["x-internal-api-key"];
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (internalKey && expectedKey && typeof internalKey === "string" &&
        internalKey.length === expectedKey.length &&
        crypto.timingSafeEqual(Buffer.from(internalKey), Buffer.from(expectedKey))) {
      const allowedPrefixes = [
        "/api/scene-builder",
        "/api/ugc",
        "/api/ad-clone",
      ];
      const isAllowedRoute = allowedPrefixes.some((p) => req.originalUrl.startsWith(p));
      if (!isAllowedRoute) {
        return res.status(403).json({ error: "Internal key not authorized for this route" });
      }
      (req as AuthRequest).user = {
        id: "internal-service",
        email: "internal@cuttr.com",
        dbUserId: -1,
      };
      (req as any).isInternalRequest = true;
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.substring(7);
    const user = await authService.verifyToken(token);

    if (!user) {
      return res.status(401).json({
        error: "Invalid or expired token",
      });
    }

    // Get database user ID
    const [dbUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.supabase_uid, user.id))
      .limit(1);

    if (!dbUser) {
      return res.status(401).json({
        error: "User not found in database",
      });
    }

    req.user = {
      id: user.id,
      email: user.email!,
      dbUserId: dbUser.id,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    Sentry.captureException(error);

    const err = error as Error & { code?: string; cause?: { code?: string } };
    const isNetworkError =
      err.code === "ETIMEDOUT" ||
      err.code === "ECONNREFUSED" ||
      err.code === "EHOSTUNREACH" ||
      err.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
      err.message?.includes("fetch failed") ||
      err.message?.includes("timeout");

    if (isNetworkError) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
      });
    }

    return res.status(401).json({
      error: "Authentication failed",
    });
  }
}

/**
 * Middleware to check if user can perform actions based on seat limits.
 * When a team is over their seat limit (e.g., downgraded from Scale to Free),
 * only the owner can perform actions.
 *
 * This middleware should be used after requireAuth and expects teamId in params.
 */
export async function requireSeatAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const teamId = parseInt(req.params.teamId);
    const userId = req.user?.dbUserId;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const { allowed, reason } = await teamService.canMemberPerformActions(
      teamId,
      userId,
    );

    if (!allowed) {
      return res.status(403).json({
        error: "Action not allowed",
        code: "SEAT_LIMIT_EXCEEDED",
        message: reason,
      });
    }

    req.seatCheckPassed = true;
    next();
  } catch (error) {
    console.error("Seat access middleware error:", error);
    Sentry.captureException(error);
    return res.status(500).json({
      error: "Failed to verify seat access",
    });
  }
}

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function checkRateLimit(
  apiKeyId: number,
): Promise<{ limited: boolean; retryAfter: number }> {
  const redis = getRedisClient();
  if (!redis) return { limited: false, retryAfter: 0 };

  const bucket = Math.floor(Date.now() / 60000);
  const key = `ratelimit:apikey:${apiKeyId}:${bucket}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);

  if (count > API_RATE_LIMIT) {
    const retryAfter = 60 - (Math.floor(Date.now() / 1000) % 60);
    return { limited: true, retryAfter };
  }

  return { limited: false, retryAfter: 0 };
}

export async function validateAPIKey(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers["x-api-key"] as string | undefined;

    if (!header) {
      return res.status(401).json({ error: "Missing X-API-Key header" });
    }

    const keyHash = hashApiKey(header);

    const [apiKey] = await db
      .select()
      .from(APIKeys)
      .where(and(eq(APIKeys.key_hash, keyHash), eq(APIKeys.revoked, false)))
      .limit(1);

    if (!apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    if (apiKey.expires_at && apiKey.expires_at < new Date()) {
      return res.status(401).json({ error: "API key expired" });
    }

    const [billing] = await db
      .select()
      .from(apiBillingAccounts)
      .where(eq(apiBillingAccounts.team_id, apiKey.team_id))
      .limit(1);

    if (!billing || !billing.active) {
      return res
        .status(403)
        .json({ error: "API billing not active for this team" });
    }

    if (billing.balance_cents <= 0) {
      return res.status(402).json({ error: "Insufficient balance" });
    }

    const { limited, retryAfter } = await checkRateLimit(apiKey.id);
    if (limited) {
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    db.update(APIKeys)
      .set({ last_used_at: new Date() })
      .where(eq(APIKeys.id, apiKey.id))
      .then(() => {})
      .catch(() => {});

    req.apiKey = {
      id: apiKey.id,
      teamId: apiKey.team_id,
      userId: apiKey.user_id,
      name: apiKey.name,
    };

    next();
  } catch (error) {
    console.error("API key validation error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
