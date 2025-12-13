import API_URL from "@/config/constants";

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
  private getHeaders(): HeadersInit {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  // Clips
  async getClips(teamId: number): Promise<Clip[]> {
    const response = await fetch(`${API_URL}/clip-video/teams/${teamId}/clips`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch clips");
    }

    const data = await response.json();
    return data.clips;
  }

  async getClip(teamId: number, clipId: number): Promise<Clip> {
    const response = await fetch(`${API_URL}/clip-video/teams/${teamId}/clips/${clipId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch clip");
    }

    const data = await response.json();
    return data.clip;
  }

  async updateClip(teamId: number, clipId: number, updates: { message?: string; clipScore?: number; folderId?: number | null }): Promise<Clip> {
    const response = await fetch(`${API_URL}/clip-video/teams/${teamId}/clips/${clipId}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error("Failed to update clip");
    }

    const data = await response.json();
    return data.clip;
  }

  async getClipsByFolder(teamId: number, folderId: number): Promise<Clip[]> {
    const response = await fetch(`${API_URL}/clip-video/teams/${teamId}/folders/${folderId}/clips`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch folder clips");
    }

    const data = await response.json();
    return data.clips;
  }

  async deleteClip(teamId: number, clipId: number): Promise<void> {
    const response = await fetch(`${API_URL}/clip-video/teams/${teamId}/clips/${clipId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to delete clip");
    }
  }

  // Folders
  async getFolders(teamId: number): Promise<Folder[]> {
    const response = await fetch(`${API_URL}/folders/teams/${teamId}/folders`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch folders");
    }

    const data = await response.json();
    return data.folders;
  }

  async getFolder(teamId: number, folderId: number): Promise<Folder> {
    const response = await fetch(`${API_URL}/folders/teams/${teamId}/folders/${folderId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch folder");
    }

    const data = await response.json();
    return data.folder;
  }

  async createFolder(teamId: number, data: { name: string; color?: string; message?: string }): Promise<Folder> {
    const response = await fetch(`${API_URL}/folders/teams/${teamId}/folders`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to create folder");
    }

    const result = await response.json();
    return result.folder;
  }

  async updateFolder(teamId: number, folderId: number, updates: { name?: string; color?: string; message?: string }): Promise<Folder> {
    const response = await fetch(`${API_URL}/folders/teams/${teamId}/folders/${folderId}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error("Failed to update folder");
    }

    const data = await response.json();
    return data.folder;
  }

  async deleteFolder(teamId: number, folderId: number): Promise<void> {
    const response = await fetch(`${API_URL}/folders/teams/${teamId}/folders/${folderId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to delete folder");
    }
  }
}

export const clipsAPI = new ClipsAPI();

