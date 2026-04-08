"use client";

const REFRESH_LOCK_KEY = "token_refresh_lock";
const REFRESH_LOCK_TIMEOUT = 10000;
const TOKEN_UPDATE_CHANNEL = "token_update";

function getApiUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_API_URL;
}

class TokenManager {
  private refreshPromise: Promise<boolean> | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private tokenVersion: number = 0;

  constructor() {
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      this.broadcastChannel = new BroadcastChannel(TOKEN_UPDATE_CHANNEL);
      this.broadcastChannel.onmessage = (event) => {
        if (event.data.type === "tokens_updated") {
          this.tokenVersion = event.data.version;
        } else if (event.data.type === "tokens_cleared") {
          this.clearTokens(false);
        }
      };
      this.tokenVersion = Date.now();
    }
  }

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

  setTokens(accessToken: string, refreshToken: string, expiresIn: number, broadcast = true): void {
    if (typeof window !== "undefined") {
      this.tokenVersion = Date.now();
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      const expiryTime = Date.now() + expiresIn * 1000;
      localStorage.setItem("token_expiry", expiryTime.toString());
      localStorage.setItem("token_version", this.tokenVersion.toString());

      if (broadcast && this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: "tokens_updated", version: this.tokenVersion });
      }
    }
  }

  clearTokens(broadcast = true): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("token_expiry");
      localStorage.removeItem("remember_me");
      localStorage.removeItem("token_version");
      localStorage.removeItem(REFRESH_LOCK_KEY);

      if (broadcast && this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: "tokens_cleared" });
      }
    }
  }

  isTokenExpiringSoon(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return !!this.getRefreshToken();
    const fiveMinutes = 5 * 60 * 1000;
    return (expiry - Date.now()) < fiveMinutes;
  }

  private acquireLock(): boolean {
    const now = Date.now();
    const lockData = localStorage.getItem(REFRESH_LOCK_KEY);
    if (lockData) {
      const { timestamp } = JSON.parse(lockData);
      if (now - timestamp < REFRESH_LOCK_TIMEOUT) return false;
    }
    localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ timestamp: now }));
    return true;
  }

  private releaseLock(): void {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  }

  private async waitForRefresh(maxWait = 5000): Promise<boolean> {
    const startTime = Date.now();
    const initialVersion = localStorage.getItem("token_version");
    while (Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const lockData = localStorage.getItem(REFRESH_LOCK_KEY);
      if (!lockData) {
        const newVersion = localStorage.getItem("token_version");
        if (newVersion && newVersion !== initialVersion) return true;
        return false;
      }
    }
    return false;
  }

  async refreshTokens(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    if (!this.acquireLock()) {
      const result = await this.waitForRefresh();
      if (result) return true;
      return !!this.getAccessToken();
    }

    this.refreshPromise = this.doRefresh(refreshToken);
    try {
      return await this.refreshPromise;
    } finally {
      this.releaseLock();
      this.refreshPromise = null;
    }
  }

  private async doRefresh(refreshToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${getApiUrl()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "";
        if (
          errorMessage.includes("Already Used") ||
          errorMessage.includes("Invalid Refresh Token") ||
          errorMessage.includes("expired") ||
          response.status === 401
        ) {
          const currentToken = this.getRefreshToken();
          if (currentToken === refreshToken) {
            this.clearTokens();
            if (typeof window !== "undefined") window.location.href = "/auth?session_expired=true";
          } else {
            return !!this.getAccessToken();
          }
        }
        return false;
      }

      const result = await response.json();
      if (result.session?.access_token) {
        this.setTokens(result.session.access_token, result.session.refresh_token, result.session.expires_in || 3600);
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

export async function apiFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuth = false, ...fetchOptions } = options;

  if (!skipAuth) {
    if (tokenManager.isTokenExpiringSoon()) {
      const refreshed = await tokenManager.refreshTokens();
      if (!refreshed) {
        if (typeof window !== "undefined") window.location.href = "/auth?session_expired=true";
        throw new Error("Session expired. Please log in again.");
      }
    }
    const token = tokenManager.getAccessToken();
    if (token) {
      fetchOptions.headers = { ...fetchOptions.headers, Authorization: `Bearer ${token}` };
    }
  }

  const response = await fetch(url, fetchOptions);

  if (response.status === 401 && !skipAuth) {
    const refreshed = await tokenManager.refreshTokens();
    if (refreshed) {
      const token = tokenManager.getAccessToken();
      fetchOptions.headers = { ...fetchOptions.headers, Authorization: `Bearer ${token}` };
      return fetch(url, fetchOptions);
    } else {
      tokenManager.clearTokens();
      if (typeof window !== "undefined") window.location.href = "/auth?session_expired=true";
      throw new Error("Session expired. Please log in again.");
    }
  }

  return response;
}
