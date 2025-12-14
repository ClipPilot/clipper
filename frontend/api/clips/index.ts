import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface Clip {
  id: number;
  team_id: number;
  generated_by_user_id: number;
  folder_id?: number | null;
  clip_path?: string;
  source_video_path?: string;
  clip_score?: number;
  clip_metadata?: any;
  input_metadata?: any;
  prompt?: string;
  message?: string;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  clipUrl?: string;
  sourceVideoUrl?: string;
  title?: string;
}

export interface Folder {
  id: number;
  team_id: number;
  name: string;
  color?: string;
  message?: string;
  created_at: string;
  updated_at: string;
}

class ClipsAPI {
  // Clips
  async getClips(teamId: number): Promise<Clip[]> {
    const response = await apiFetch(`${API_URL}/clip-video/teams/${teamId}/clips`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch clips");
    }

    const data = await response.json();
    return data.clips;
  }

  async getClip(teamId: number, clipId: number): Promise<Clip> {
    const response = await apiFetch(`${API_URL}/clip-video/teams/${teamId}/clips/${clipId}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch clip");
    }

    const data = await response.json();
    return data.clip;
  }

  async updateClip(teamId: number, clipId: number, updates: { message?: string; clipScore?: number; folderId?: number | null }): Promise<Clip> {
    const response = await apiFetch(`${API_URL}/clip-video/teams/${teamId}/clips/${clipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error("Failed to update clip");
    }

    const data = await response.json();
    return data.clip;
  }

  async getClipsByFolder(teamId: number, folderId: number): Promise<Clip[]> {
    const response = await apiFetch(`${API_URL}/clip-video/teams/${teamId}/folders/${folderId}/clips`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch folder clips");
    }

    const data = await response.json();
    return data.clips;
  }

  async deleteClip(teamId: number, clipId: number): Promise<void> {
    const response = await apiFetch(`${API_URL}/clip-video/teams/${teamId}/clips/${clipId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to delete clip");
    }
  }

  async getPendingClips(teamId: number): Promise<Clip[]> {
    const response = await apiFetch(`${API_URL}/clip-video/teams/${teamId}/clips/pending`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch pending clips");
    }

    const data = await response.json();
    return data.clips;
  }

  // Folders
  async getFolders(teamId: number): Promise<Folder[]> {
    const response = await apiFetch(`${API_URL}/folders/teams/${teamId}/folders`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch folders");
    }

    const data = await response.json();
    return data.folders;
  }

  async getFolder(teamId: number, folderId: number): Promise<Folder> {
    const response = await apiFetch(`${API_URL}/folders/teams/${teamId}/folders/${folderId}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch folder");
    }

    const data = await response.json();
    return data.folder;
  }

  async createFolder(teamId: number, data: { name: string; color?: string; message?: string }): Promise<Folder> {
    const response = await apiFetch(`${API_URL}/folders/teams/${teamId}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to create folder");
    }

    const result = await response.json();
    return result.folder;
  }

  async updateFolder(teamId: number, folderId: number, updates: { name?: string; color?: string; message?: string }): Promise<Folder> {
    const response = await apiFetch(`${API_URL}/folders/teams/${teamId}/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error("Failed to update folder");
    }

    const data = await response.json();
    return data.folder;
  }

  async deleteFolder(teamId: number, folderId: number): Promise<void> {
    const response = await apiFetch(`${API_URL}/folders/teams/${teamId}/folders/${folderId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to delete folder");
    }
  }
}

export const clipsAPI = new ClipsAPI();
