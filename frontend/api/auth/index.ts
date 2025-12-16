import API_URL from "@/config/constants";
import { tokenManager, apiFetch } from "@/lib/apiClient";

export interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface SignInData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  user: User;
  session: Session;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
}

class AuthAPI {
  async signUp(data: SignUpData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || error.message || "Failed to sign up");
    }

    const result: AuthResponse = await response.json();
    if (result.session && (result.session as any).access_token) {
      tokenManager.setTokens(
        (result.session as any).access_token,
        (result.session as any).refresh_token,
        (result.session as any).expires_in || 3600
      );
    }
    return result;
  }

  async signIn(data: SignInData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || error.message || "Failed to sign in");
    }

    const result: AuthResponse = await response.json();
    if (result.session && (result.session as any).access_token) {
      tokenManager.setTokens(
        (result.session as any).access_token,
        (result.session as any).refresh_token,
        (result.session as any).expires_in || 3600
      );
      if (data.rememberMe !== undefined && typeof window !== "undefined") {
        localStorage.setItem("remember_me", data.rememberMe.toString());
      }
    }
    return result;
  }

  async signOut(): Promise<void> {
    try {
      await apiFetch(`${API_URL}/auth/signout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } finally {
      tokenManager.clearTokens();
    }
  }

  async getMe(): Promise<User> {
    const response = await apiFetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || error.message || "Failed to get user");
    }

    const data = await response.json();
    return data.user;
  }

  async resetPassword(email: string): Promise<void> {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || error.message || "Failed to send reset email");
    }
  }

  async updatePassword(accessToken: string, newPassword: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/update-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ password: newPassword }),
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || error.message || "Failed to update password");
    }

    const result = await response.json();
    if (result.session && (result.session as any).access_token) {
      tokenManager.setTokens(
        (result.session as any).access_token,
        (result.session as any).refresh_token,
        (result.session as any).expires_in || 3600
      );
    }
    return result;
  }

  isAuthenticated(): boolean {
    return !!tokenManager.getAccessToken();
  }

  async ensureValidTokenPublic(): Promise<void> {
    if (tokenManager.isTokenExpiringSoon()) {
      const refreshed = await tokenManager.refreshTokens();
      if (!refreshed) {
        throw new Error("Session expired");
      }
    }
  }

  async updateProfile(data: { firstName?: string; lastName?: string }): Promise<User> {
    const response = await apiFetch(`${API_URL}/auth/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.error || error.message || "Failed to update profile");
    }

    const result = await response.json();
    return result.user;
  }
}

export const authAPI = new AuthAPI();
