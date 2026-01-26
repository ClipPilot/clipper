import API_URL from "@/config/constants";
import { apiJson } from "@/lib/apiClient";
import { Announcement } from "@/store/announcements";

interface GetUnreadAnnouncementsResponse {
  announcements: Announcement[];
}

interface ApiResponse {
  success: boolean;
  message: string;
}

class AnnouncementsAPI {
  /**
   * Get unread announcements for the authenticated user (badge count)
   */
  async getUnreadAnnouncements(): Promise<Announcement[]> {
    const response = await apiJson<GetUnreadAnnouncementsResponse>(
      `${API_URL}/announcements/unread`,
      {
        method: "GET",
      }
    );
    return response.announcements;
  }

  /**
   * Get all announcements (read + unread) for inbox view
   */
  async getAllAnnouncements(): Promise<Announcement[]> {
    const response = await apiJson<GetUnreadAnnouncementsResponse>(
      `${API_URL}/announcements/all`,
      {
        method: "GET",
      }
    );
    return response.announcements;
  }

  /**
   * Dismiss a single announcement
   */
  async dismissAnnouncement(announcementId: number): Promise<void> {
    await apiJson<ApiResponse>(
      `${API_URL}/announcements/${announcementId}/dismiss`,
      {
        method: "POST",
      }
    );
  }

  /**
   * Dismiss all unread announcements
   */
  async dismissAllAnnouncements(): Promise<void> {
    await apiJson<ApiResponse>(`${API_URL}/announcements/dismiss-all`, {
      method: "POST",
    });
  }
}

export const announcementsAPI = new AnnouncementsAPI();
