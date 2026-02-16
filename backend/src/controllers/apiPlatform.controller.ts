import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { apiKeyService } from "../services/apiKey.service";

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

    const created = await apiKeyService.create(
      teamId,
      req.user!.dbUserId,
      name,
      expires_at ? new Date(expires_at) : undefined,
    );

    return res.status(201).json({
      id: created.id,
      name: created.name,
      key: created.raw,
      key_prefix: created.key_prefix,
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

    const keys = await apiKeyService.listByTeam(teamId);
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

    const revoked = await apiKeyService.revoke(teamId, keyId);

    if (!revoked) {
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
