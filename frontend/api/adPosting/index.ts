import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface ClipPost {
  id: number;
  platform: string;
  status: string;
  post_url: string | null;
  drive_file_id: string | null;
  posted_time: string | null;
  created_at: string;
}

class AdPostingAPI {
  async postToPlatforms(
    teamId: number,
    clipId: number,
    platforms: string[]
  ): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/ad-posting/teams/${teamId}/post`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clipId, platforms }),
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
}

export const adPostingAPI = new AdPostingAPI();
