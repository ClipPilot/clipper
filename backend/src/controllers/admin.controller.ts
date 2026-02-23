import * as Sentry from "@sentry/node";
import { Response } from "express";
import { adminService } from "../services/admin.service";
import { referralService } from "../services/referral.service";
import { AdminRequest } from "../middleware/admin.middleware";

export async function login(req: AdminRequest, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    if (!adminService.validateCredentials(email, password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Send 2FA code to the admin email
    await adminService.send2FACode(email);

    return res.json({
      message: "Verification code sent to your email",
      email,
      requires2FA: true,
    });
  } catch (error) {
    console.error("Admin login error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Login failed" });
  }
}

export async function verify2FA(req: AdminRequest, res: Response) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res
        .status(400)
        .json({ error: "Email and verification code required" });
    }

    const isValid = await adminService.verify2FACode(email, code);

    if (!isValid) {
      return res
        .status(401)
        .json({ error: "Invalid or expired verification code" });
    }

    const token = adminService.generateToken(email);
    return res.json({ token, email });
  } catch (error) {
    console.error("Admin 2FA verification error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Verification failed" });
  }
}

// Resend 2FA code
export async function resend2FA(req: AdminRequest, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    // Re-validate credentials before resending
    if (!adminService.validateCredentials(email, password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await adminService.send2FACode(email);

    return res.json({
      message: "New verification code sent to your email",
      email,
    });
  } catch (error) {
    console.error("Admin resend 2FA error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to resend code" });
  }
}

export async function getAllTeams(req: AdminRequest, res: Response) {
  try {
    const { search, limit, offset } = req.query;
    const result = await adminService.getAllTeams({
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error("Get teams error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch teams" });
  }
}

export async function getTeam(req: AdminRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const team = await adminService.getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    return res.json({ team });
  } catch (error) {
    console.error("Get team error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to fetch team" });
  }
}

export async function setupEnterprise(req: AdminRequest, res: Response) {
  try {
    const { teamId, clipLimit, monthlyPrice, customerEmail } = req.body;

    if (!teamId || !clipLimit || !monthlyPrice || !customerEmail) {
      return res.status(400).json({
        error:
          "teamId, clipLimit, monthlyPrice, and customerEmail are required",
      });
    }

    const monthlyPriceCents = Math.round(parseFloat(monthlyPrice) * 100);

    const result = await adminService.setupEnterprise(
      parseInt(teamId),
      parseInt(clipLimit),
      monthlyPriceCents,
      customerEmail
    );

    return res.json({
      success: true,
      checkoutUrl: result.checkoutUrl,
      priceId: result.priceId,
    });
  } catch (error) {
    console.error("Setup enterprise error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to setup enterprise" });
  }
}

export async function changePlan(req: AdminRequest, res: Response) {
  try {
    const { teamId, newPlan, clipLimit, monthlyPrice, customerEmail } =
      req.body;

    if (!teamId || !newPlan) {
      return res.status(400).json({
        error: "teamId and newPlan are required",
      });
    }

    if (newPlan === "enterprise") {
      if (!clipLimit || !monthlyPrice || !customerEmail) {
        return res.status(400).json({
          error:
            "clipLimit, monthlyPrice, and customerEmail are required for enterprise plan",
        });
      }

      const monthlyPriceCents = Math.round(parseFloat(monthlyPrice) * 100);

      const result = await adminService.changePlanToEnterprise(
        parseInt(teamId),
        parseInt(clipLimit),
        monthlyPriceCents,
        customerEmail
      );

      return res.json({
        success: true,
        checkoutUrl: result.checkoutUrl,
        priceId: result.priceId,
        hasPreviousSubscription: result.hasPreviousSubscription,
      });
    }

    return res
      .status(400)
      .json({ error: "Only enterprise plan changes are currently supported" });
  } catch (error) {
    console.error("Change plan error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to change plan" });
  }
}

export async function getAllReferrals(req: AdminRequest, res: Response) {
  try {
    const referrals = await referralService.getAllReferralsAdmin();
    return res.json({ referrals });
  } catch (error) {
    console.error("Get all referrals error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to get referrals" });
  }
}

export async function setReferralReward(req: AdminRequest, res: Response) {
  try {
    const { referralId, bonusClips, percentOff } = req.body;

    if (referralId === undefined) {
      return res.status(400).json({ error: "referralId is required" });
    }

    const success = await referralService.setReferralReward(
      parseInt(referralId),
      parseInt(bonusClips) || 0,
      parseFloat(percentOff) || 0
    );

    if (!success) {
      return res.status(404).json({ error: "Referral not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Set referral reward error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to set referral reward" });
  }
}
