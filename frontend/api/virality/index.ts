import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface MetricsEntry {
  recorded_at: string;
  likes: number;
  comments: number;
  views: number | null;
}

export interface ViralityTarget {
  id: number;
  team_id: number;
  competitor_id: number | null;
  platform: "instagram";
  username: string;
  profile_url: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number | null;
  following_count: number | null;
  total_likes: number | null;
  post_count: number | null;
  is_verified: boolean;
  last_synced_at: string | null;
  sync_status: "pending" | "syncing" | "completed" | "failed";
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViralityPost {
  id: number;
  target_id: number;
  platform_post_id: string;
  post_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  hashtags: string[];
  post_type: string | null;
  posted_at: string | null;
  like_count: number;
  comment_count: number;
  video_view_count: number | null;
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

export interface CompetitorWithTargets extends ViralityCompetitor {
  targets: ViralityTarget[];
}

export interface DashboardStats {
  targetsCount: number;
  maxTargets: number;
  totalFollowers: number;
  totalLikes: number;
  totalPosts: number;
  targets: ViralityTarget[];
}

class ViralityAPI {
  // ── Targets ──

  async getTargets(teamId: number): Promise<ViralityTarget[]> {
    const response = await apiFetch(`${API_URL}/virality/${teamId}/targets`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch targets");
    }

    const data = await response.json();
    return data.targets;
  }

  async addTarget(
    teamId: number,
    platform: "instagram",
    profileUrl: string,
    competitorId?: number
  ): Promise<ViralityTarget> {
    const response = await apiFetch(`${API_URL}/virality/${teamId}/targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ platform, profileUrl, competitorId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add target");
    }

    const data = await response.json();
    return data.target;
  }

  async deleteTarget(teamId: number, targetId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/targets/${targetId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete target");
    }
  }

  async syncTarget(
    teamId: number,
    targetId: number
  ): Promise<{ success: boolean; postsProcessed: number }> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/targets/${targetId}/sync`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to sync target");
    }

    return response.json();
  }

  async getTargetPosts(
    teamId: number,
    targetId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<ViralityPost[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/targets/${targetId}/posts?${params}`,
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
    return data.posts;
  }

  async getDashboardStats(teamId: number): Promise<DashboardStats> {
    const response = await apiFetch(
      `${API_URL}/virality/${teamId}/dashboard`,
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

  async getCompetitor(
    teamId: number,
    competitorId: number
  ): Promise<CompetitorWithTargets> {
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
}

export const viralityAPI = new ViralityAPI();
