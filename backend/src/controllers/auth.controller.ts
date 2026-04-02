import { Request, Response } from "express";
import type { User, Session, AuthResponse, ErrorResponse } from "../types/api.types";
import { authService } from "../services/auth.service";
import { userService } from "../services/user.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { handleControllerError, requireUser } from "../utils/controllerHelpers";
export class AuthController {
  async signUp(req: Request, res: Response<AuthResponse | ErrorResponse>) {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({
          error:
            "Missing required fields: email, password, firstName, lastName",
        });
      }

      const result = await authService.signUp(
        email,
        password,
        firstName,
        lastName
      );

      return res.status(201).json({
        message: "User created successfully",
        user: {
          id: result.dbUser.id.toString(),
          email: result.dbUser.email,
          firstName: result.dbUser.first_name,
          lastName: result.dbUser.last_name,
          emailNotificationsEnabled: result.dbUser.email_notifications_enabled,
        },
        session: result.session,
      });
    } catch (error) {
      return handleControllerError(res, "Signup error", error, "Failed to sign up", 400);
    }
  }

  async signIn(req: Request, res: Response<AuthResponse | ErrorResponse>) {
    try {
      const { email, password, rememberMe = false } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: "Missing required fields: email, password",
        });
      }

      const result = await authService.signIn(email, password, rememberMe);

      return res.status(200).json({
        message: "Signed in successfully",
        user: {
          id: result.dbUser.id.toString(),
          email: result.dbUser.email,
          firstName: result.dbUser.first_name,
          lastName: result.dbUser.last_name,
          emailNotificationsEnabled: result.dbUser.email_notifications_enabled,
        },
        session: result.session,
        rememberMe: result.rememberMe,
      });
    } catch (error) {
      return handleControllerError(res, "Signin error", error, "Failed to sign in", 401);
    }
  }

  async signInWithSupabase(req: Request, res: Response<AuthResponse | ErrorResponse>) {
    try {
      const { accessToken, refreshToken } = req.body;

      if (!accessToken || !refreshToken) {
        return res.status(400).json({
          error: "Missing accessToken or refreshToken",
        });
      }

      const result = await authService.signInWithSupabase(
        accessToken,
        refreshToken
      );

      return res.status(200).json({
        message: "Signed in successfully",
        user: {
          id: result.dbUser.id.toString(),
          email: result.dbUser.email,
          firstName: result.dbUser.first_name,
          lastName: result.dbUser.last_name,
          emailNotificationsEnabled: result.dbUser.email_notifications_enabled,
        },
        session: result.session,
      });
    } catch (error) {
      return handleControllerError(res, "Supabase signin error", error, "Failed to sign in with Google", 401);
    }
  }

  async signOut(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Missing or invalid authorization header",
        });
      }

      const token = authHeader.substring(7);
      await authService.signOut(token);

      return res.status(200).json({
        message: "Signed out successfully",
      });
    } catch (error) {
      return handleControllerError(res, "Signout error", error, "Failed to sign out", 400);
    }
  }

  async getMe(req: Request, res: Response<{ user: User } | ErrorResponse>) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Missing or invalid authorization header",
        });
      }

      const token = authHeader.substring(7);
      const result = await authService.getUser(token);

      return res.status(200).json({
        user: {
          id: result.dbUser.id.toString(),
          email: result.dbUser.email,
          firstName: result.dbUser.first_name,
          lastName: result.dbUser.last_name,
          emailNotificationsEnabled: result.dbUser.email_notifications_enabled,
        },
      });
    } catch (error) {
      return handleControllerError(res, "Get user error", error, "Failed to get user", 401);
    }
  }

  async refreshSession(req: Request, res: Response<{ session: Session | null; user: User | null } | ErrorResponse>) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: "Missing refresh token",
        });
      }

      const result = await authService.refreshSession(refreshToken);

      return res.status(200).json({
        session: result.session,
        user: result.user,
      });
    } catch (error) {
      return handleControllerError(res, "Refresh session error", error, "Failed to refresh session", 401);
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: "Missing required field: email",
        });
      }

      const result = await authService.resetPassword(email);

      return res.status(200).json(result);
    } catch (error) {
      return handleControllerError(res, "Reset password error", error, "Failed to send reset email", 400);
    }
  }

  async updatePassword(req: Request, res: Response<AuthResponse | ErrorResponse>) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Missing or invalid authorization header",
        });
      }

      const token = authHeader.substring(7);
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          error: "Missing required field: password",
        });
      }

      const result = await authService.updatePassword(token, password);

      return res.status(200).json({
        message: "Password updated successfully",
        session: result.session,
        user: {
          id: result.dbUser.id.toString(),
          email: result.dbUser.email,
          firstName: result.dbUser.first_name,
          lastName: result.dbUser.last_name,
          emailNotificationsEnabled: result.dbUser.email_notifications_enabled,
        },
      });
    } catch (error) {
      return handleControllerError(res, "Update password error", error, "Failed to update password", 400);
    }
  }
  async updateProfile(req: AuthRequest, res: Response<{ message: string; user: User } | ErrorResponse>) {
    try {
      const userId = requireUser(req, res);
      if (!userId) return;

      const { firstName, lastName, emailNotificationsEnabled } = req.body;

      const dbUser = await userService.getUserBySupabaseUid(userId);
      const updated = await userService.updateUser(dbUser.id, {
        firstName,
        lastName,
        emailNotificationsEnabled,
      });

      return res.status(200).json({
        message: "Profile updated successfully",
        user: {
          id: updated.id.toString(),
          email: updated.email,
          firstName: updated.first_name,
          lastName: updated.last_name,
          emailNotificationsEnabled: updated.email_notifications_enabled,
        },
      });
    } catch (error) {
      return handleControllerError(res, "Update profile error", error, "Failed to update profile", 400);
    }
  }
}

export const authController = new AuthController();
