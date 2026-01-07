import API_URL from "@/config/constants";
import { tokenManager } from "@/lib/apiClient";

interface AuthResponse {
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    is_affiliate: boolean;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export const authAPI = {
  isAuthenticated: () => {
    return !!tokenManager.getAccessToken();
  },

  async signIn(data: { email: string; password: string }): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Sign in failed" }));
      throw new Error(error.error || error.message);
    }

    const result = await response.json();
    if (result.session) {
      tokenManager.setTokens(
        result.session.access_token,
        result.session.refresh_token,
        result.session.expires_in
      );
    }

    return result;
  },

  async signUp(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        first_name: data.firstName,
        last_name: data.lastName,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Sign up failed" }));
      throw new Error(error.error || error.message);
    }

    const result = await response.json();
    if (result.session) {
      tokenManager.setTokens(
        result.session.access_token,
        result.session.refresh_token,
        result.session.expires_in
      );
    }

    return result;
  },

  async signOut(): Promise<void> {
    try {
      const accessToken = tokenManager.getAccessToken();
      if (accessToken) {
        await fetch(`${API_URL}/auth/signout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }
    } finally {
      tokenManager.clearTokens();
    }
  },

  async getMe(): Promise<AuthResponse["user"]> {
    const accessToken = tokenManager.getAccessToken();
    if (!accessToken) throw new Error("Not authenticated");

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error("Failed to get user");
    }

    const result = await response.json();
    return result.user;
  },
};
