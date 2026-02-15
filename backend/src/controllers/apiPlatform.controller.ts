import * as Sentry from "@sentry/node";
import crypto from "crypto";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { hashApiKey } from "../middleware/auth.middleware";
import { db } from "../db";
import { APIKeys } from "@clipper/shared-db/src/schema";
import { eq, and, desc } from "drizzle-orm";

export const createApiKeyController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const { name, expires_at } = req.body;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }

    const raw = `sk_live_${crypto.randomBytes(32).toString("base64url")}`;
    const keyHash = hashApiKey(raw);
    const keyPrefix = raw.slice(0, 12);

    const [created] = await db
      .insert(APIKeys)
      .values({
        team_id: teamId,
        user_id: req.user!.dbUserId,
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        expires_at: expires_at ? new Date(expires_at) : null,
      })
      .returning();

    return res.status(201).json({
      id: created.id,
      name: created.name,
      key: raw,
      key_prefix: keyPrefix,
      expires_at: created.expires_at,
      created_at: created.created_at,
    });
  } catch (err) {
    console.error("Error in createApiKeyController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create API key",
    });
  }
};

export const listApiKeysController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const keys = await db
      .select({
        id: APIKeys.id,
        name: APIKeys.name,
        key_prefix: APIKeys.key_prefix,
        revoked: APIKeys.revoked,
        last_used_at: APIKeys.last_used_at,
        expires_at: APIKeys.expires_at,
        created_at: APIKeys.created_at,
      })
      .from(APIKeys)
      .where(eq(APIKeys.team_id, teamId))
      .orderBy(desc(APIKeys.created_at));

    return res.json({ keys });
  } catch (err) {
    console.error("Error in listApiKeysController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to list API keys",
    });
  }
};

export const revokeApiKeyController = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const keyId = parseInt(req.params.keyId);

    if (isNaN(teamId) || isNaN(keyId)) {
      return res.status(400).json({ error: "Invalid team ID or key ID" });
    }

    const [updated] = await db
      .update(APIKeys)
      .set({ revoked: true, updated_at: new Date() })
      .where(and(eq(APIKeys.id, keyId), eq(APIKeys.team_id, teamId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "API key not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in revokeApiKeyController:", err);
    Sentry.captureException(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to revoke API key",
    });
  }
};
