import { tokenManager, apiFetch } from "@/lib/apiClient";
import type { User } from "@clipper/shared-types";

export type { User };

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface SignInData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

class AuthAPI {
  async signIn(data: SignInData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to sign in");
    }

    const result = await response.json();
    if (result.session?.access_token) {
      tokenManager.setTokens(
        result.session.access_token,
        result.session.refresh_token,
        result.session.expires_in || 3600
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
      const error = await response.json();
      throw new Error(error.error || error.message || "Failed to get user");
    }

    const data = await response.json();
    return data.user;
  }

  isAuthenticated(): boolean {
    return !!tokenManager.getAccessToken();
  }
}

export const authAPI = new AuthAPI();
