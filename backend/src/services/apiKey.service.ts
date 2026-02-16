import crypto from "crypto";
import { db } from "../db";
import { APIKeys } from "@clipper/shared-db/src/schema";
import { eq, and, desc } from "drizzle-orm";
import { hashApiKey } from "../middleware/auth.middleware";

class ApiKeyService {
  async create(teamId: number, userId: number, name: string, expiresAt?: Date) {
    const raw = `sk_live_${crypto.randomBytes(32).toString("base64url")}`;
    const keyHash = hashApiKey(raw);
    const keyPrefix = raw.slice(0, 12);

    const [created] = await db
      .insert(APIKeys)
      .values({
        team_id: teamId,
        user_id: userId,
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        expires_at: expiresAt ?? null,
      })
      .returning();

    return { ...created, raw };
  }

  async listByTeam(teamId: number) {
    return db
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
  }

  async revoke(teamId: number, keyId: number) {
    const [updated] = await db
      .update(APIKeys)
      .set({ revoked: true, updated_at: new Date() })
      .where(and(eq(APIKeys.id, keyId), eq(APIKeys.team_id, teamId)))
      .returning();

    return updated ?? null;
  }
}

export const apiKeyService = new ApiKeyService();
