import { Request, Response, NextFunction } from "express";
import { adminService } from "../services/admin.service";

export interface AdminRequest extends Request {
  admin?: { email: string; isAdmin: boolean };
}

export async function requireAdminAuth(
  req: AdminRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.substring(7);
    const admin = adminService.verifyToken(token);

    if (!admin || !admin.isAdmin) {
      return res.status(401).json({ error: "Invalid or expired admin token" });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    return res.status(401).json({ error: "Authentication failed" });
  }
}
