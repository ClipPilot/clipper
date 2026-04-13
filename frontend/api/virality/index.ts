import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import { filterExcludedPostTypes } from "@/lib/viralityConstants";
export type {
  ViralityAccount,
  ViralityPost,
  ViralityCompetitor,
  ViralSettings,
  CompetitorWithAccounts,
  ViralityPostsByAccount,
} from "@clipper/shared-types";
import type {
  ViralityAccount,
  ViralityPost,
  ViralityCompetitor,
  ViralSettings,
  ViralityDashboard,
  CompetitorWithAccounts,
} from "@clipper/shared-types";

export type DashboardStats = ViralityDashboard;

export type MetricsEntry = NonNullable<ViralityPost["metrics_history"]>[number];

export type FollowerEntry = NonNullable<ViralityAccount["follower_history"]>[number];

export type AccountPostStats = NonNullable<DashboardStats["accountPostStats"]>[string];

export type AlertLog = {
  id: number;
  team_id: number;
  user_id: number | null;
  email: string;
  subject: string;
  email_body: string;
  viral_post_ids: number[];
  status: "sent" | "failed";
  error_message: string | null;
  sent_at: string;
  created_at: string;
};

class ViralityAPI {
  async getAccounts(teamId: number): Promise<ViralityAccount[]> {
    const response = await apiFetch(`${API_URL}/virality/${teamId}/accounts`, {
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
    groupId: number,
    accountType: "profile" | "hashtag" | "keyword" = "profile",
    competitor: boolean = true
  ): Promise<ViralityAccount> {
    const response = await apiFetch(`${API_URL}/virality/${teamId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ platform, profileUrl, groupId, accountType, competitor }),
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
      `${API_URL}/virality/${teamId}/accounts/${accountId}/status`,
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
      `${API_URL}/virality/${teamId}/accounts/${accountId}`,
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
      `${API_URL}/virality/${teamId}/accounts/${accountId}/sync`,
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
      `${API_URL}/virality/${teamId}/accounts/${accountId}/posts?${params}`,
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
    return filterExcludedPostTypes(data.posts as ViralityPost[]);
  }

  async deletePost(teamId: number, postId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/posts/${postId}`,
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
      `${API_URL}/virality/${teamId}/dashboard${queryString ? `?${queryString}` : ""}`,
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

  async getGroups(teamId: number): Promise<ViralityCompetitor[]> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/competitors`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch groups");
    }

    const data = await response.json();
    return data.competitors;
  }

  async createGroup(
    teamId: number,
    name: string,
    description?: string,
    competitor: boolean = true
  ): Promise<ViralityCompetitor> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/competitors`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description, competitor }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create group");
    }

    const data = await response.json();
    return data.competitor;
  }

  async updateGroup(
    teamId: number,
    groupId: number,
    data: { name?: string; description?: string }
  ): Promise<ViralityCompetitor> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/competitors/${groupId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update group");
    }

    const result = await response.json();
    return result.competitor;
  }

  async getGroupWithAccounts(
    teamId: number,
    groupId: number
  ): Promise<CompetitorWithAccounts> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/competitors/${groupId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch group");
    }

    const data = await response.json();
    return data.competitor;
  }

  async deleteGroup(teamId: number, groupId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/competitors/${groupId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete group");
    }
  }

  async updateAlertEnabled(teamId: number, accountId: number, alertEnabled: boolean): Promise<ViralityAccount> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/accounts/${accountId}/alerts`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alert_enabled: alertEnabled }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update alert setting");
    }

    const data = await response.json();
    return data.account;
  }

  async getSettings(teamId: number): Promise<ViralSettings> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/settings`,
      { credentials: "include" }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get settings");
    }

    const data = await response.json();
    return data.settings;
  }

  async getAlertLogs(
    teamId: number,
    limit: number = 5,
    offset: number = 0
  ): Promise<AlertLog[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/alert-logs?${params}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch alert logs");
    }

    const data = await response.json();
    return data.logs;
  }

  async getGroupsWithAccounts(teamId: number): Promise<CompetitorWithAccounts[]> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/competitors-with-accounts`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch groups");
    }

    const data = await response.json();
    return data.competitors;
  }

  async getAllPosts(
    teamId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Record<number, ViralityPost[]>> {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const qs = params.toString();

    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/posts${qs ? `?${qs}` : ""}`,
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
    const result: Record<number, ViralityPost[]> = {};
    for (const [accountId, posts] of Object.entries(data.postsByAccount)) {
      result[Number(accountId)] = filterExcludedPostTypes(posts as ViralityPost[]);
    }
    return result;
  }

  async saveSettings(teamId: number, settings: ViralSettings): Promise<ViralSettings> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/settings`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save settings");
    }

    const data = await response.json();
    return data.settings;
  }
}

export const viralityAPI = new ViralityAPI();
