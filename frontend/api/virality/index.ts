import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface MetricsEntry {
  recorded_at: string;
  likes: number;
  comments: number;
  views: number | null;
}

export interface FollowerEntry {
  recorded_at: string;
  followers: number;
}

export interface ViralityAccount {
  id: number;
  team_id: number;
  competitor_id: number | null;
  platform: "instagram" | "tiktok" | "x";
  account_type: "profile" | "hashtag" | "keyword";
  username: string;
  profile_url: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number | null;
  following_count: number | null;
  total_likes: number | null;
  post_count: number | null;
  follower_history: FollowerEntry[] | null;
  is_verified: boolean;
  is_active: boolean;
  alert_enabled: boolean;
  syncs_remaining: number;
  last_synced_at: string | null;
  sync_status: "pending" | "syncing" | "completed" | "failed";
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViralityPost {
  id: number;
  account_id: number;
  platform_post_id: string;
  post_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  hashtags: string[];
  post_type: string | null;
  posted_at: string | null;
  like_count: number;
  comment_count: number;
  video_play_count: number | null;
  metrics_history: MetricsEntry[];
  created_at: string;
  updated_at: string;
}

export interface ViralityCompetitor {
  id: number;
  team_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitorWithAccounts extends ViralityCompetitor {
  accounts: ViralityAccount[];
}

export interface AccountPostStats {
  totalViews: number;
  postCount: number;
}

export interface DashboardStats {
  accountsCount: number;
  totalFollowers: number;
  totalLikes: number;
  totalPosts: number;
  totalViews: number;
  avgViewsPerPost: number;
  accountPostStats: Record<number, AccountPostStats>;
  accounts: ViralityAccount[];
}

export interface ViralAlertSettings {
  percentThreshold: number | null;
  absoluteThreshold: number | null;
  thresholdMode: "and" | "or";
  timeFrameHours: number;
  enabledAccountIds: number[];
}

export interface ViralAlertLog {
  id: number;
  team_id: number;
  user_id: number;
  email: string;
  subject: string;
  email_body: string;
  viral_post_ids: number[];
  status: "sent" | "failed";
  error_message: string | null;
  sent_at: string;
  created_at: string;
}

class ViralityAPI {
  // ── Accounts ──

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
    competitorId?: number,
    accountType: "profile" | "hashtag" | "keyword" = "profile"
  ): Promise<ViralityAccount> {
    const response = await apiFetch(`${API_URL}/virality/${teamId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ platform, profileUrl, competitorId, accountType }),
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
  ): Promise<{ success: boolean; postsProcessed: number }> {
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
    const EXCLUDED_TYPES = new Set(["sidecar", "retweet", "quote", "image"]);
    return (data.posts as ViralityPost[]).filter(
      (p) => !p.post_type || !EXCLUDED_TYPES.has(p.post_type.toLowerCase())
    );
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

  // ── Competitors ──

  async getCompetitors(teamId: number): Promise<ViralityCompetitor[]> {
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
      throw new Error(error.error || "Failed to fetch competitors");
    }

    const data = await response.json();
    return data.competitors;
  }

  async createCompetitor(
    teamId: number,
    name: string,
    description?: string
  ): Promise<ViralityCompetitor> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/competitors`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create competitor");
    }

    const data = await response.json();
    return data.competitor;
  }

  async updateCompetitor(
    teamId: number,
    competitorId: number,
    data: { name?: string; description?: string }
  ): Promise<ViralityCompetitor> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/competitors/${competitorId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update competitor");
    }

    const result = await response.json();
    return result.competitor;
  }

  async getCompetitor(
    teamId: number,
    competitorId: number
  ): Promise<CompetitorWithAccounts> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/competitors/${competitorId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch competitor");
    }

    const data = await response.json();
    return data.competitor;
  }

  async deleteCompetitor(teamId: number, competitorId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/competitors/${competitorId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete competitor");
    }
  }

  // ── Settings ──

  async getSettings(teamId: number): Promise<ViralAlertSettings> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/settings`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch settings");
    }

    const data = await response.json();
    return data.settings;
  }

  async saveSettings(teamId: number, settings: ViralAlertSettings): Promise<ViralAlertSettings> {
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

  async getAlertLogs(
    teamId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<ViralAlertLog[]> {
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
}

export const viralityAPI = new ViralityAPI();
