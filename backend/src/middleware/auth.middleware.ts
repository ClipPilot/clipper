import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { db } from "../db";
import { users } from "@clipper/shared-db/src/schema";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    dbUserId: number;
  };
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
    return res.status(401).json({
      error: "Authentication failed",
    });
  }
}
