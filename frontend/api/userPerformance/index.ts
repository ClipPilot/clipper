import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import type {
  ViralityAccount,
  ViralityPost,
  DashboardStats,
} from "@/api/virality";

export type { ViralityAccount as UserAccount, ViralityPost as UserPost };

class UserPerformanceAPI {
  // ── Accounts ──

  async getAccounts(teamId: number): Promise<ViralityAccount[]> {
    const response = await apiFetch(`${API_URL}/user-performance/${teamId}/accounts`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch accounts");
    }

    const data = await response.json();
    return data.accounts;
  }

  async addAccount(
    teamId: number,
    platform: "instagram" | "tiktok" | "x",
    profileUrl: string,
    accountType: "profile" | "hashtag" | "keyword" = "profile"
  ): Promise<ViralityAccount> {
    const response = await apiFetch(`${API_URL}/user-performance/${teamId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ platform, profileUrl, accountType }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add account");
    }

    const data = await response.json();
    return data.account;
  }

  async updateAccountStatus(teamId: number, accountId: number, isActive: boolean): Promise<ViralityAccount> {
    const response = await apiFetch(
      `${API_URL}/user-performance/${teamId}/accounts/${accountId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: isActive }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update account status");
    }

    const data = await response.json();
    return data.account;
  }

  async deleteAccount(teamId: number, accountId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/user-performance/${teamId}/accounts/${accountId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete account");
    }
  }

  async syncAccount(
    teamId: number,
    accountId: number
  ): Promise<{ accepted: boolean; accountId: number }> {
    const response = await apiFetch(
      `${API_URL}/user-performance/${teamId}/accounts/${accountId}/sync`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to sync account");
    }

    return response.json();
  }

  async syncAll(
    teamId: number
  ): Promise<{ accepted: boolean; accountIds: number[] }> {
    const response = await apiFetch(
      `${API_URL}/user-performance/${teamId}/sync-all`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to sync all");
    }

    return response.json();
  }

  async getAccountPosts(
    teamId: number,
    accountId: number,
    limit: number = 20,
    offset: number = 0,
    startDate?: string,
    endDate?: string
  ): Promise<ViralityPost[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const response = await apiFetch(
      `${API_URL}/user-performance/${teamId}/accounts/${accountId}/posts?${params}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch posts");
    }

    const data = await response.json();
    const EXCLUDED_TYPES = new Set(["sidecar", "retweet", "quote", "image"]);
    return (data.posts as ViralityPost[]).filter(
      (p) => !p.post_type || !EXCLUDED_TYPES.has(p.post_type.toLowerCase())
    );
  }

  async deletePost(teamId: number, postId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/user-performance/${teamId}/posts/${postId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete post");
    }
  }

  async getDashboardStats(
    teamId: number,
    startDate?: string,
    endDate?: string
  ): Promise<DashboardStats> {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const queryString = params.toString();

    const response = await apiFetch(
      `${API_URL}/user-performance/${teamId}/dashboard${queryString ? `?${queryString}` : ""}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch dashboard");
    }

    return response.json();
  }
}

export const userPerformanceAPI = new UserPerformanceAPI();
