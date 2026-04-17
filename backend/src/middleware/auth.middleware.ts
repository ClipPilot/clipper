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
import { eq, and, inArray } from "drizzle-orm";
import { teamService } from "../services/team.service";
import {
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDel,
} from "../services/redis.service";

const API_RATE_LIMIT = 60;

const USER_CACHE_PREFIX = "auth:user:v1:";
const USER_CACHE_TTL = 300;

const APIKEY_CACHE_PREFIX = "auth:apikey:v1:";
const APIKEY_CACHE_TTL = 60;
const APIKEY_PENDING_USAGE_KEY = "auth:apikey:pending:v1";

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

type CachedUser = { dbUserId: number };

type CachedApiKeyContext = {
  apiKey: {
    id: number;
    team_id: number;
    user_id: number;
    name: string;
    expires_at: string | null;
  };
  billing: { active: boolean; balance_cents: number };
};

async function resolveUserBySupabaseUid(
  supabaseUid: string,
): Promise<CachedUser | null> {
  const cacheKey = `${USER_CACHE_PREFIX}${supabaseUid}`;

  const cached = await cacheGet<CachedUser>(cacheKey);
  if (cached) return cached;

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.supabase_uid, supabaseUid))
    .limit(1);

  if (!dbUser) return null;

  const result: CachedUser = { dbUserId: dbUser.id };
  await cacheSet(cacheKey, result, USER_CACHE_TTL);
  return result;
}

export async function invalidateUserCache(supabaseUid: string): Promise<void> {
  await cacheDel(`${USER_CACHE_PREFIX}${supabaseUid}`);
}

async function resolveApiKeyContext(
  keyHash: string,
): Promise<CachedApiKeyContext | null> {
  const cacheKey = `${APIKEY_CACHE_PREFIX}${keyHash}`;

  const cached = await cacheGet<CachedApiKeyContext>(cacheKey);
  if (cached) return cached;

  const [apiKey] = await db
    .select()
    .from(APIKeys)
    .where(and(eq(APIKeys.key_hash, keyHash), eq(APIKeys.revoked, false)))
    .limit(1);

  if (!apiKey) return null;

  const [billing] = await db
    .select()
    .from(apiBillingAccounts)
    .where(eq(apiBillingAccounts.team_id, apiKey.team_id))
    .limit(1);

  const ctx: CachedApiKeyContext = {
    apiKey: {
      id: apiKey.id,
      team_id: apiKey.team_id,
      user_id: apiKey.user_id,
      name: apiKey.name,
      expires_at: apiKey.expires_at
        ? new Date(apiKey.expires_at).toISOString()
        : null,
    },
    billing: billing
      ? { active: !!billing.active, balance_cents: billing.balance_cents }
      : { active: false, balance_cents: 0 },
  };

  await cacheSet(cacheKey, ctx, APIKEY_CACHE_TTL);
  return ctx;
}

export async function invalidateApiKeyCache(keyHash: string): Promise<void> {
  await cacheDel(`${APIKEY_CACHE_PREFIX}${keyHash}`);
}

async function markApiKeyUsed(apiKeyId: number): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    if (Math.random() < 0.1) {
      db.update(APIKeys)
        .set({ last_used_at: new Date() })
        .where(eq(APIKeys.id, apiKeyId))
        .catch(() => {});
    }
    return;
  }
  try {
    await client.sadd(APIKEY_PENDING_USAGE_KEY, String(apiKeyId));
  } catch {
    /* best-effort */
  }
}

export async function flushPendingApiKeyUsage(): Promise<number> {
  const client = getRedisClient();
  if (!client) return 0;

  const stagingKey = `${APIKEY_PENDING_USAGE_KEY}:staging:${process.pid}:${Date.now()}`;

  try {
    await client.rename(APIKEY_PENDING_USAGE_KEY, stagingKey);
  } catch (err) {
    const msg = (err as Error)?.message || "";
    if (msg.includes("no such key")) return 0;
    console.error("[apikey-usage-flush] rename failed:", msg);
    return 0;
  }

  const raw = await client.smembers(stagingKey);
  const ids = raw.map(Number).filter((n) => Number.isFinite(n) && n > 0);

  if (ids.length === 0) {
    await client.del(stagingKey).catch(() => {});
    return 0;
  }

  try {
    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = ids.slice(i, i + CHUNK);
      await db
        .update(APIKeys)
        .set({ last_used_at: new Date() })
        .where(inArray(APIKeys.id, batch));
    }
    await client.del(stagingKey).catch(() => {});
    return ids.length;
  } catch (err) {
    console.error(
      "[apikey-usage-flush] batch update failed, re-queueing:",
      (err as Error).message,
    );
    try {
      await client.sunionstore(
        APIKEY_PENDING_USAGE_KEY,
        APIKEY_PENDING_USAGE_KEY,
        stagingKey,
      );
    } catch (mergeErr) {
      console.error(
        "[apikey-usage-flush] re-queue failed, IDs retained in staging:",
        (mergeErr as Error).message,
      );
      return 0;
    }
    await client.del(stagingKey).catch(() => {});
    return 0;
  }
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const internalKey = req.headers["x-internal-api-key"];
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (
      internalKey &&
      expectedKey &&
      typeof internalKey === "string" &&
      internalKey.length === expectedKey.length &&
      crypto.timingSafeEqual(
        Buffer.from(internalKey),
        Buffer.from(expectedKey),
      )
    ) {
      const allowedPrefixes = [
        "/api/scene-builder",
        "/api/ugc",
        "/api/ad-clone",
      ];
      const isAllowedRoute = allowedPrefixes.some((p) =>
        req.originalUrl.startsWith(p),
      );
      if (!isAllowedRoute) {
        return res
          .status(403)
          .json({ error: "Internal key not authorized for this route" });
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

    const cachedUser = await resolveUserBySupabaseUid(user.id);

    if (!cachedUser) {
      return res.status(401).json({
        error: "User not found in database",
      });
    }

    req.user = {
      id: user.id,
      email: user.email!,
      dbUserId: cachedUser.dbUserId,
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
    const ctx = await resolveApiKeyContext(keyHash);

    if (!ctx) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    if (ctx.apiKey.expires_at && new Date(ctx.apiKey.expires_at) < new Date()) {
      await invalidateApiKeyCache(keyHash);
      return res.status(401).json({ error: "API key expired" });
    }

    if (!ctx.billing.active) {
      return res
        .status(403)
        .json({ error: "API billing not active for this team" });
    }

    if (ctx.billing.balance_cents <= 0) {
      return res.status(402).json({ error: "Insufficient balance" });
    }

    const { limited, retryAfter } = await checkRateLimit(ctx.apiKey.id);
    if (limited) {
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    void markApiKeyUsed(ctx.apiKey.id);

    req.apiKey = {
      id: ctx.apiKey.id,
      teamId: ctx.apiKey.team_id,
      userId: ctx.apiKey.user_id,
      name: ctx.apiKey.name,
    };

    next();
  } catch (error) {
    console.error("API key validation error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Re-exported so a batch writer can reuse the import chain without pulling schema in directly.
export const _apiKeyUsageInternals = { APIKeys, inArray, eq };
