import API_URL from "@/config/constants";
export interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface SignInData {
  email: string;
  password: string;
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
  private getHeaders(includeAuth: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (includeAuth) {
      const token = this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  private getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refresh_token");
  }

  private getTokenExpiry(): number | null {
    if (typeof window === "undefined") return null;
    const expiry = localStorage.getItem("token_expiry");
    return expiry ? parseInt(expiry) : null;
  }

  private setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      // Store expiry time as timestamp (current time + expiresIn seconds)
      const expiryTime = Date.now() + expiresIn * 1000;
      localStorage.setItem("token_expiry", expiryTime.toString());
    }
  }

  private clearTokens(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("token_expiry");
    }
  }

  private isTokenExpiringSoon(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return true;

    // Refresh if token expires in less than 5 minutes
    const fiveMinutes = 5 * 60 * 1000;
    return (expiry - Date.now()) < fiveMinutes;
  }

  private async ensureValidToken(): Promise<void> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    if (this.isTokenExpiringSoon()) {
      await this.refreshSession(refreshToken);
    }
  }

  async signUp(data: SignUpData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || "Failed to sign up");
    }

    const result: AuthResponse = await response.json();
    if (result.session && (result.session as any).access_token) {
      this.setTokens(
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
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || "Failed to sign in");
    }

    const result: AuthResponse = await response.json();
    if (result.session && (result.session as any).access_token) {
      this.setTokens(
        (result.session as any).access_token,
        (result.session as any).refresh_token,
        (result.session as any).expires_in || 3600
      );
    }
    return result;
  }

  async signOut(): Promise<void> {
    const response = await fetch(`${API_URL}/auth/signout`, {
      method: "POST",
      headers: this.getHeaders(true),
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || "Failed to sign out");
    }

    this.clearTokens();
  }

  async getMe(): Promise<User> {
    // Ensure token is valid before making the request
    try {
      await this.ensureValidToken();
    } catch (error) {
      // If refresh fails, clear tokens and throw
      this.clearTokens();
      throw new Error("Session expired. Please log in again.");
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: this.getHeaders(true),
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || "Failed to get user");
    }

    const data = await response.json();
    return data.user;
  }

  async refreshSession(refreshToken: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || "Failed to refresh session");
    }

    const result: AuthResponse = await response.json();
    if (result.session && (result.session as any).access_token) {
      this.setTokens(
        (result.session as any).access_token,
        (result.session as any).refresh_token,
        (result.session as any).expires_in || 3600
      );
    }
    return result;
  }

  async resetPassword(email: string): Promise<void> {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ email }),
      credentials: "include",
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw new Error(error.message || "Failed to send reset email");
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
      throw new Error(error.message || "Failed to update password");
    }

    const result = await response.json();
    if (result.session && (result.session as any).access_token) {
      this.setTokens(
        (result.session as any).access_token,
        (result.session as any).refresh_token,
        (result.session as any).expires_in || 3600
      );
    }
    return result;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authAPI = new AuthAPI();



