import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { affiliateService } from "../services/affiliate.service";

export async function generateCodeController(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.dbUserId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const isAffiliate = await affiliateService.isAffiliate(userId);
    if (!isAffiliate) {
      return res.status(403).json({ error: "User is not an affiliate" });
    }

    const existingCode = await affiliateService.getCodeByUserId(userId);
    if (existingCode) {
      return res.json({ code: existingCode });
    }

    const newCode = await affiliateService.generateCode(userId);
    return res.status(201).json({ code: newCode });
  } catch (error) {
    console.error("Generate affiliate code error:", error);
    return res.status(500).json({ error: "Failed to generate affiliate code" });
  }
}

export async function getCodeController(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.dbUserId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const code = await affiliateService.getCodeByUserId(userId);
    return res.json({ code });
  } catch (error) {
    console.error("Get affiliate code error:", error);
    return res.status(500).json({ error: "Failed to get affiliate code" });
  }
}

export async function getAffiliatedTeamsController(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.dbUserId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const data = await affiliateService.getAffiliatedTeams(userId);
    return res.json(data);
  } catch (error) {
    console.error("Get affiliated teams error:", error);
    return res.status(500).json({ error: "Failed to get affiliated teams" });
  }
}

export async function getStatsController(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.dbUserId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const stats = await affiliateService.getAffiliateStats(userId);
    return res.json(stats);
  } catch (error) {
    console.error("Get affiliate stats error:", error);
    return res.status(500).json({ error: "Failed to get affiliate stats" });
  }
}

export async function becomeAffiliateController(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.dbUserId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await affiliateService.becomeAffiliate(userId);
    return res.json({ success: true, message: "You are now an affiliate" });
  } catch (error) {
    console.error("Become affiliate error:", error);
    return res.status(500).json({ error: "Failed to become affiliate" });
  }
}

export async function validateCodeController(req: Request, res: Response) {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    const result = await affiliateService.validateCode(code);
    return res.json(result);
  } catch (error) {
    console.error("Validate code error:", error);
    return res.status(500).json({ error: "Failed to validate code" });
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
      return res.status(400).json({ error: "Code is required" });
    }

    const success = await affiliateService.applyAffiliateCode(teamId, code);
    if (!success) {
      return res.status(400).json({ error: "Invalid or already used affiliate code" });
    }

    return res.json({ success: true, message: "Affiliate code applied successfully" });
  } catch (error) {
    console.error("Apply affiliate code error:", error);
    return res.status(500).json({ error: "Failed to apply affiliate code" });
  }
}

export async function getMeController(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.dbUserId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const isAffiliate = await affiliateService.isAffiliate(userId);
    return res.json({ isAffiliate });
  } catch (error) {
    console.error("Get affiliate status error:", error);
    return res.status(500).json({ error: "Failed to get affiliate status" });
  }
}
