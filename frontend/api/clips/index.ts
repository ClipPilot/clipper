import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface CaptionEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface Clip {
  id: number;
  team_id: number;
  generated_by_user_id: number;
  folder_id?: number | null;
  clip_path?: string;
  blank_video_path?: string;
  watermarked_clip_path?: string;
  srt_path?: string;
  captions_data?: CaptionEntry[];
  source_video_path?: string;
  clip_score?: number;
  clip_metadata?: any;
  input_metadata?: any;
  prompt?: string;
  message?: string;
  status: string;
  saved: boolean;
  error_message?: string;
  created_at: string;
  updated_at: string;
  clipUrl?: string;
  sourceVideoUrl?: string;
  blankVideoUrl?: string;
  title?: string;
  raw_video_id?: number | null;
  raw_video_path?: string;
  rawVideoUrl?: string;
  tags?: Tag[];
}

export interface Folder {
  id: number;
  team_id: number;
  parent_folder_id?: number | null;
  name: string;
  color?: string;
  message?: string;
  created_at: string;
  updated_at: string;
}

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
}

export interface Tag {
  id: number;
  team_id: number;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

class ClipsAPI {
  // Clips
  async getClips(teamId: number): Promise<Clip[]> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch clips");
    }

    const data = await response.json();
    return data.clips;
  }

  async getCompletedClips(
    teamId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ clips: Clip[]; hasMore: boolean }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/completed?limit=${limit}&offset=${offset}`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch clips");
    }

    const data = await response.json();
    return {
      clips: data.clips,
      hasMore: data.pagination?.hasMore ?? data.clips.length === limit,
    };
  }

  async getClip(teamId: number, clipId: number): Promise<Clip> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch clip");
    }

    const data = await response.json();
    return data.clip;
  }

  async updateClip(
    teamId: number,
    clipId: number,
    updates: { message?: string; clipScore?: number; folderId?: number | null }
  ): Promise<Clip> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update clip");
    }

    const data = await response.json();
    return data.clip;
  }

  async getClipsByFolder(teamId: number, folderId: number): Promise<Clip[]> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/folders/${folderId}/clips`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch folder clips");
    }

    const data = await response.json();
    return data.clips;
  }

  async deleteClip(teamId: number, clipId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete clip");
    }
  }

  async rejectClip(teamId: number, clipId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to reject clip");
    }
  }

  async getPendingClips(teamId: number): Promise<Clip[]> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/pending`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch pending clips");
    }

    const data = await response.json();
    return data.clips;
  }

  // Folders
  async getFolders(teamId: number): Promise<Folder[]> {
    const response = await apiFetch(
      `${API_URL}/folders/teams/${teamId}/folders`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch folders");
    }

    const data = await response.json();
    return data.folders;
  }

  async getFolder(teamId: number, folderId: number): Promise<Folder> {
    const response = await apiFetch(
      `${API_URL}/folders/teams/${teamId}/folders/${folderId}`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch folder");
    }

    const data = await response.json();
    return data.folder;
  }

  async createFolder(
    teamId: number,
    data: { name: string; color?: string; message?: string; parentFolderId?: number | null }
  ): Promise<Folder> {
    const response = await apiFetch(
      `${API_URL}/folders/teams/${teamId}/folders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to create folder");
    }

    const result = await response.json();
    return result.folder;
  }

  async getFolderTree(teamId: number): Promise<FolderTreeNode[]> {
    const response = await apiFetch(
      `${API_URL}/folders/teams/${teamId}/folders/tree`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch folder tree");
    }

    const data = await response.json();
    return data.tree;
  }

  async moveFolder(
    teamId: number,
    folderId: number,
    parentFolderId: number | null
  ): Promise<Folder> {
    const response = await apiFetch(
      `${API_URL}/folders/teams/${teamId}/folders/${folderId}/move`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentFolderId }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to move folder");
    }

    const data = await response.json();
    return data.folder;
  }

  async getFolderPath(teamId: number, folderId: number): Promise<Folder[]> {
    const response = await apiFetch(
      `${API_URL}/folders/teams/${teamId}/folders/${folderId}/path`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch folder path");
    }

    const data = await response.json();
    return data.path;
  }

  async updateFolder(
    teamId: number,
    folderId: number,
    updates: { name?: string; color?: string; message?: string }
  ): Promise<Folder> {
    const response = await apiFetch(
      `${API_URL}/folders/teams/${teamId}/folders/${folderId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update folder");
    }

    const data = await response.json();
    return data.folder;
  }

  async deleteFolder(teamId: number, folderId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/folders/teams/${teamId}/folders/${folderId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete folder");
    }
  }

  async updateCaptions(
    teamId: number,
    clipId: number,
    captionsData: CaptionEntry[],
    captionColor?: string,
    captionFont?: string
  ): Promise<{ clipUrl: string; captionsData: CaptionEntry[] }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/captions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionsData, captionColor, captionFont }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update captions");
    }

    return response.json();
  }

  async updateTextOverlay(
    teamId: number,
    clipId: number,
    overlay: { text: string; color: string; x: number; y: number; fontSize: number }
  ): Promise<{ clipUrl: string }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/text-overlay`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overlay),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update text overlay");
    }

    return response.json();
  }

  async saveClip(teamId: number, clipId: number): Promise<{ clip: Clip; usage: any }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/save`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save clip");
    }

    return response.json();
  }

  async getUnsavedClips(teamId: number): Promise<Clip[]> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/unsaved`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch unsaved clips");
    }

    const data = await response.json();
    return data.clips;
  }

  async getSavedClips(
    teamId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ clips: Clip[]; hasMore: boolean }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/saved?limit=${limit}&offset=${offset}`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch saved clips");
    }

    const data = await response.json();
    return {
      clips: data.clips,
      hasMore: data.pagination?.hasMore ?? data.clips.length === limit,
    };
  }

  async getTags(teamId: number): Promise<Tag[]> {
    const response = await apiFetch(
      `${API_URL}/tags/teams/${teamId}/tags`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch tags");
    }

    const data = await response.json();
    return data.tags;
  }

  async createTag(
    teamId: number,
    data: { name: string; color?: string }
  ): Promise<Tag> {
    const response = await apiFetch(
      `${API_URL}/tags/teams/${teamId}/tags`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to create tag");
    }

    const result = await response.json();
    return result.tag;
  }

  async updateTag(
    teamId: number,
    tagId: number,
    updates: { name?: string; color?: string }
  ): Promise<Tag> {
    const response = await apiFetch(
      `${API_URL}/tags/teams/${teamId}/tags/${tagId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update tag");
    }

    const data = await response.json();
    return data.tag;
  }

  async deleteTag(teamId: number, tagId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/tags/teams/${teamId}/tags/${tagId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete tag");
    }
  }

  async getClipTags(clipId: number): Promise<Tag[]> {
    const response = await apiFetch(
      `${API_URL}/tags/clips/${clipId}/tags`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch clip tags");
    }

    const data = await response.json();
    return data.tags;
  }

  async setClipTags(clipId: number, tagIds: number[]): Promise<Tag[]> {
    const response = await apiFetch(
      `${API_URL}/tags/clips/${clipId}/tags`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to set clip tags");
    }

    const data = await response.json();
    return data.tags;
  }

  async addTagToClip(clipId: number, tagId: number): Promise<Tag[]> {
    const response = await apiFetch(
      `${API_URL}/tags/clips/${clipId}/tags/${tagId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to add tag to clip");
    }

    const data = await response.json();
    return data.tags;
  }

  async removeTagFromClip(clipId: number, tagId: number): Promise<Tag[]> {
    const response = await apiFetch(
      `${API_URL}/tags/clips/${clipId}/tags/${tagId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to remove tag from clip");
    }

    const data = await response.json();
    return data.tags;
  }
}

export const clipsAPI = new ClipsAPI();
