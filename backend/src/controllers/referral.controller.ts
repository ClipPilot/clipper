import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { referralService } from "../services/referral.service";

export async function generateCodeController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const existingCode = await referralService.getCodeByTeamId(teamId);
    if (existingCode) {
      return res.json({ code: existingCode });
    }

    const newCode = await referralService.generateCode(teamId);
    return res.status(201).json({ code: newCode });
  } catch (error) {
    console.error("Generate referral code error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to generate referral code" });
  }
}

export async function getCodeController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const code = await referralService.getCodeByTeamId(teamId);
    return res.json({ code });
  } catch (error) {
    console.error("Get referral code error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to get referral code" });
  }
}

export async function applyCodeController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const { code } = req.body;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    if (!code) {
      return res.status(400).json({ error: "Referral code is required" });
    }

    const success = await referralService.applyReferralCode(teamId, code);
    if (!success) {
      return res.status(400).json({ error: "Invalid or already used referral code" });
    }

    return res.json({ success: true, message: "Referral code applied successfully" });
  } catch (error) {
    console.error("Apply referral code error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to apply referral code" });
  }
}

export async function getReferralsController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const data = await referralService.getReferralsByTeam(teamId);
    return res.json(data);
  } catch (error) {
    console.error("Get referrals error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to get referrals" });
  }
}

export async function getStatsController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const stats = await referralService.getReferralStats(teamId);
    return res.json(stats);
  } catch (error) {
    console.error("Get referral stats error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to get referral stats" });
  }
}

export async function validateCodeController(req: AuthRequest, res: Response) {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ error: "Referral code is required" });
    }

    const referralCode = await referralService.getCodeByCode(code);
    if (!referralCode) {
      return res.json({ valid: false });
    }

    return res.json({ valid: true, code: referralCode.code });
  } catch (error) {
    console.error("Validate referral code error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to validate referral code" });
  }
}
