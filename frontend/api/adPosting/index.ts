import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import type { TeamPostsResponse, AccountStatsResponse } from "@/types/massPosting";

export interface ClipPost {
  id: number;
  platform: string;
  status: string;
  post_url: string | null;
  drive_file_id: string | null;
  posted_time: string | null;
  created_at: string;
}

export interface GetTeamPostsParams {
  tab?: "queued" | "published";
  platform?: string;
  dateRange?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

class AdPostingAPI {
  async postToPlatforms(
    teamId: number,
    clipId: number,
    platformQuantities: Record<string, number>
  ): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/ad-posting/teams/${teamId}/post`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clipId, platformQuantities }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to start ad posting");
    }
  }

  async getClipPosts(
    teamId: number,
    clipId: number
  ): Promise<ClipPost[]> {
    const response = await apiFetch(
      `${API_URL}/ad-posting/teams/${teamId}/clips/${clipId}/posts`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get clip posts");
    }

    const data = await response.json();
    return data.posts;
  }

  async getTeamPosts(
    teamId: number,
    params: GetTeamPostsParams = {}
  ): Promise<TeamPostsResponse> {
    const searchParams = new URLSearchParams();

    if (params.tab) searchParams.set("tab", params.tab);
    if (params.platform) searchParams.set("platform", params.platform);
    if (params.dateRange) searchParams.set("dateRange", params.dateRange);
    if (params.search) searchParams.set("search", params.search);
    if (params.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());

    const qs = searchParams.toString();
    const response = await apiFetch(
      `${API_URL}/ad-posting/teams/${teamId}/posts${qs ? `?${qs}` : ""}`,
      { credentials: "include" }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get team posts");
    }

    return response.json();
  }

  async getAccountStats(
    teamId: number,
    params: { dateRange?: string } = {}
  ): Promise<AccountStatsResponse> {
    const searchParams = new URLSearchParams();
    if (params.dateRange) searchParams.set("dateRange", params.dateRange);
    const qs = searchParams.toString();

    const response = await apiFetch(
      `${API_URL}/ad-posting/teams/${teamId}/accounts${qs ? `?${qs}` : ""}`,
      { credentials: "include" }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get account stats");
    }

    return response.json();
  }

  async createCustomVideo(
    teamId: number,
    fileName: string,
    contentType: string
  ): Promise<{ clipId: number; uploadUrl: string; s3Key: string }> {
    const response = await apiFetch(
      `${API_URL}/ad-posting/teams/${teamId}/custom-video`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileName, contentType }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create custom video");
    }

    return response.json();
  }

  async completeCustomVideo(
    teamId: number,
    clipId: number
  ): Promise<{ clipId: number }> {
    const response = await apiFetch(
      `${API_URL}/ad-posting/teams/${teamId}/custom-video/${clipId}/complete`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to complete custom video");
    }

    return response.json();
  }
}

export const adPostingAPI = new AdPostingAPI();
