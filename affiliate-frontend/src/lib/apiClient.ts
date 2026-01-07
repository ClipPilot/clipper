import API_URL from "@/config/constants";

export const tokenManager = {
  getAccessToken: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  },

  getRefreshToken: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refresh_token");
  },

  setTokens: (accessToken: string, refreshToken: string, expiresIn: number) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    localStorage.setItem(
      "token_expiry",
      (Date.now() + expiresIn * 1000).toString()
    );
  },

  clearTokens: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("token_expiry");
  },

  isTokenExpired: () => {
    if (typeof window === "undefined") return true;
    const expiry = localStorage.getItem("token_expiry");
    if (!expiry) return true;
    return Date.now() > parseInt(expiry) - 5 * 60 * 1000;
  },

  refreshTokens: async () => {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      tokenManager.clearTokens();
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        tokenManager.clearTokens();
        return false;
      }

      const data = await response.json();
      if (data.session) {
        tokenManager.setTokens(
          data.session.access_token,
          data.session.refresh_token,
          data.session.expires_in
        );
        return true;
      }

      tokenManager.clearTokens();
      return false;
    } catch {
      tokenManager.clearTokens();
      return false;
    }
  },
};

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (tokenManager.isTokenExpired()) {
    const refreshed = await tokenManager.refreshTokens();
    if (!refreshed && typeof window !== "undefined") {
      window.location.href = "/auth?session_expired=true";
      throw new Error("Session expired");
    }
  }

  const accessToken = tokenManager.getAccessToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (accessToken) {
    (headers as Record<string, string>)["Authorization"] =
      `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    const refreshed = await tokenManager.refreshTokens();
    if (refreshed) {
      return apiFetch(url, options);
    }
    if (typeof window !== "undefined") {
      window.location.href = "/auth?session_expired=true";
    }
    throw new Error("Session expired");
  }

  return response;
}

export async function apiJson<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}
