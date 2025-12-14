import API_URL from "@/config/constants";

class TokenManager {
  private refreshPromise: Promise<boolean> | null = null;

  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refresh_token");
  }

  private getTokenExpiry(): number | null {
    if (typeof window === "undefined") return null;
    const expiry = localStorage.getItem("token_expiry");
    return expiry ? parseInt(expiry) : null;
  }

  setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      const expiryTime = Date.now() + expiresIn * 1000;
      localStorage.setItem("token_expiry", expiryTime.toString());
    }
  }

  clearTokens(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("token_expiry");
      localStorage.removeItem("remember_me");
    }
  }

  isTokenExpiringSoon(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) {
      return !!this.getRefreshToken();
    }
    const fiveMinutes = 5 * 60 * 1000;
    return (expiry - Date.now()) < fiveMinutes;
  }

  async refreshTokens(): Promise<boolean> {
    // If already refreshing, wait for that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    // Create a new refresh promise
    this.refreshPromise = this.doRefresh(refreshToken);

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(refreshToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "";

        // If token is already used or invalid, clear everything and force re-login
        if (
          errorMessage.includes("Already Used") ||
          errorMessage.includes("Invalid Refresh Token") ||
          errorMessage.includes("expired") ||
          response.status === 401
        ) {
          console.warn("Refresh token invalid, clearing session");
          this.clearTokens();
          // Redirect to login with session_expired flag
          if (typeof window !== "undefined") {
            window.location.href = "/auth?session_expired=true";
          }
        }
        return false;
      }

      const result = await response.json();
      if (result.session?.access_token) {
        this.setTokens(
          result.session.access_token,
          result.session.refresh_token,
          result.session.expires_in || 3600
        );
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}

export const tokenManager = new TokenManager();

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipAuth = false, ...fetchOptions } = options;

  if (!skipAuth) {
    // Check if token needs refresh before making request
    if (tokenManager.isTokenExpiringSoon()) {
      const refreshed = await tokenManager.refreshTokens();
      if (!refreshed) {
        // Token refresh failed - redirect to login
        if (typeof window !== "undefined") {
          window.location.href = "/auth?session_expired=true";
        }
        throw new Error("Session expired. Please log in again.");
      }
    }

    // Add auth header
    const token = tokenManager.getAccessToken();
    if (token) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }

  const response = await fetch(url, fetchOptions);

  // If we get a 401, try to refresh once
  if (response.status === 401 && !skipAuth) {
    const refreshed = await tokenManager.refreshTokens();
    if (refreshed) {
      // Retry the request with new token
      const token = tokenManager.getAccessToken();
      fetchOptions.headers = {
        ...fetchOptions.headers,
        Authorization: `Bearer ${token}`,
      };
      return fetch(url, fetchOptions);
    } else {
      // Refresh failed - clear tokens and redirect
      tokenManager.clearTokens();
      if (typeof window !== "undefined") {
        window.location.href = "/auth?session_expired=true";
      }
      throw new Error("Session expired. Please log in again.");
    }
  }

  return response;
}

export async function apiJson<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await apiFetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || error.error || "Request failed");
  }

  return response.json();
}
