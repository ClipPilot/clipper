import { Request, Response } from "express";
import { authService } from "../services/auth.service";
export class AuthController {
  async signUp(req: Request, res: Response) {
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
        },
        session: result.session,
      });
    } catch (error) {
      console.error("Signup error:", error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to sign up",
      });
    }
  }

  async signIn(req: Request, res: Response) {
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
        },
        session: result.session,
        rememberMe: result.rememberMe,
      });
    } catch (error) {
      console.error("Signin error:", error);
      return res.status(401).json({
        error: error instanceof Error ? error.message : "Failed to sign in",
      });
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
      console.error("Signout error:", error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to sign out",
      });
    }
  }

  async getMe(req: Request, res: Response) {
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
        },
      });
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(401).json({
        error: error instanceof Error ? error.message : "Failed to get user",
      });
    }
  }

  async refreshSession(req: Request, res: Response) {
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
      console.error("Refresh session error:", error);
      return res.status(401).json({
        error:
          error instanceof Error ? error.message : "Failed to refresh session",
      });
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
      console.error("Reset password error:", error);
      return res.status(400).json({
        error:
          error instanceof Error ? error.message : "Failed to send reset email",
      });
    }
  }

  async updatePassword(req: Request, res: Response) {
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
        },
      });
    } catch (error) {
      console.error("Update password error:", error);
      return res.status(400).json({
        error:
          error instanceof Error ? error.message : "Failed to update password",
      });
    }
  }
}

export const authController = new AuthController();
