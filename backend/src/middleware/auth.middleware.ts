import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { db } from "../db";
import { users } from "@clipper/shared-db/src/schema";
import { eq } from "drizzle-orm";
import { teamService } from "../services/team.service";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    dbUserId: number;
  };
  seatCheckPassed?: boolean;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
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
      .select()
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

    const err = error as Error & { code?: string; cause?: { code?: string } };
    const isNetworkError =
      err.code === 'ETIMEDOUT' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'EHOSTUNREACH' ||
      err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
      err.message?.includes('fetch failed') ||
      err.message?.includes('timeout');

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
  next: NextFunction
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

    const { allowed, reason } = await teamService.canMemberPerformActions(teamId, userId);

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
    return res.status(500).json({
      error: "Failed to verify seat access",
    });
  }
}
