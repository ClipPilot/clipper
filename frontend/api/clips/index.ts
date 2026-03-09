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
  share_token?: string | null;
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
    updates: { title?: string; message?: string; clipScore?: number; folderId?: number | null }
  ): Promise<Clip> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to update clip");
    }

    return data.clip;
  }

  async getClipsByFolder(teamId: number, folderId: number, sort: "newest" | "oldest" = "newest"): Promise<Clip[]> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/folders/${folderId}/clips?sort=${sort}`,
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

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to create folder");
    }

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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to move folder");
    }

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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to update folder");
    }

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
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to delete folder");
    }
  }

  async downloadFolder(teamId: number, folderId: number): Promise<Blob> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/folders/${folderId}/download`,
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to download folder");
    }

    return response.blob();
  }

  async updateCaptions(
    teamId: number,
    clipId: number,
    captionsData: CaptionEntry[],
    captionColor?: string,
    captionFont?: string,
    captionsEnabled?: boolean
  ): Promise<{ clipUrl: string; captionsData: CaptionEntry[] }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/captions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionsData, captionColor, captionFont, captionsEnabled }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update captions");
    }

    return response.json();
  }

  async generateCaptions(
    teamId: number,
    clipId: number
  ): Promise<{ captionsData: CaptionEntry[]; message?: string }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/generate-captions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to generate captions");
    }

    return response.json();
  }

  async updateTextOverlay(
    teamId: number,
    clipId: number,
    overlay: { text: string; color: string; font?: string; x: number; y: number; fontSize: number; style?: "stroke" | "instagram" }
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

  async generateHeading(
    teamId: number,
    clipId: number,
  ): Promise<{ heading: string }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/generate-heading`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to generate heading");
    }

    return response.json();
  }

  async updateClipOverlays(
    teamId: number,
    clipId: number,
    options: {
      // Caption options
      captionsEnabled: boolean;
      captionsData?: CaptionEntry[];
      captionColor?: string;
      captionFont?: string;
      // Heading options
      heading?: {
        text: string;
        color: string;
        font: string;
        x: number;
        y: number;
        fontSize: number;
        style?: "stroke" | "instagram";
      };
    }
  ): Promise<{ clipUrl: string }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/overlays`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update clip overlays");
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
    offset: number = 0,
    sort: "newest" | "oldest" = "newest"
  ): Promise<{ clips: Clip[]; hasMore: boolean }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/saved?limit=${limit}&offset=${offset}&sort=${sort}`,
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

  // Sharing
  async generateShareLink(teamId: number, clipId: number): Promise<string> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/share`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to generate share link");
    }

    const data = await response.json();
    return data.shareToken;
  }

  async removeShareLink(teamId: number, clipId: number): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/share`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to remove share link");
    }
  }

  async getSharedClip(shareToken: string): Promise<{
    id: number;
    title?: string;
    message?: string;
    clipUrl: string;
    created_at: string;
  }> {
    const response = await fetch(
      `${API_URL}/clip-video/shared/${shareToken}`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Shared clip not found");
    }

    const data = await response.json();
    return data.clip;
  }

  async getSharedClipDownloadUrl(shareToken: string): Promise<string> {
    const response = await fetch(
      `${API_URL}/clip-video/shared/${shareToken}/download`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get download URL");
    }

    const data = await response.json();
    return data.downloadUrl;
  }

  async searchClips(
    teamId: number,
    params: {
      q?: string;
      tags?: number[];
      status?: string;
      folderId?: number | null;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    clips: Clip[];
    pagination: { limit: number; offset: number; total: number; hasMore: boolean };
    query: string | null;
    filters: { tags: number[] | null; status: string | null; folderId: number | null };
  }> {
    const searchParams = new URLSearchParams();
    searchParams.set("teamId", teamId.toString());

    if (params.q) searchParams.set("q", params.q);
    if (params.tags && params.tags.length > 0) searchParams.set("tags", params.tags.join(","));
    if (params.status) searchParams.set("status", params.status);
    if (params.folderId !== undefined) {
      searchParams.set("folderId", params.folderId === null ? "null" : params.folderId.toString());
    }
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.offset) searchParams.set("offset", params.offset.toString());

    const response = await apiFetch(
      `${API_URL}/clip-video/search-clips?${searchParams.toString()}`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to search clips");
    }

    return response.json();
  }

  // Video Editor
  async submitVideoEdit(
    teamId: number,
    clipId: number,
    editConfig: {
      trim?: { startTime: number; endTime: number };
      crop?: { aspectRatio: string; customCrop?: { x: number; y: number; width: number; height: number } };
      speed?: number;
      audio?: {
        originalVolume: number;
        originalMuted: boolean;
        backgroundMusic?: {
          s3Key: string;
          volume: number;
          startTime: number;  // Where in video timeline music begins
          trimStart: number;  // Where in music file to start
          trimEnd: number;    // Where in music file to end
        };
      };
      captions?: {
        enabled: boolean;
        data: CaptionEntry[];
        color: string;
        font: string;
      };
      heading?: {
        text: string;
        color: string;
        font: string;
        x: number;
        y: number;
        fontSize: number;
        style?: "stroke" | "instagram";
      };
      overlays?: Array<{
        id: string;
        type: "image" | "video" | "comment";
        s3Key: string;
        fileName: string;
        startTime: number;
        endTime: number;
        x: number;
        y: number;
        scale: number;
        opacity: number;
        naturalWidth: number;
        naturalHeight: number;
        commentData?: {
          platform: "tiktok" | "youtube" | "instagram";
          username: string;
          commentText: string;
          profilePictureS3Key?: string;
          likesCount: number;
          isVerified: boolean;
          timeAgo?: string;
        };
      }>;
    }
  ): Promise<{ message: string; jobId: string }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/edit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editConfig }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to submit video edit");
    }

    return response.json();
  }

  async getMusicUploadUrl(
    teamId: number,
    clipId: number,
    fileName: string,
    contentType: string
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/music`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, contentType }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get music upload URL");
    }

    return response.json();
  }

  async uploadMusicToS3(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed"));
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  }

  // Media Overlay Upload
  async getOverlayUploadUrl(
    teamId: number,
    clipId: number,
    fileName: string,
    contentType: string
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/overlay-upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, contentType }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get overlay upload URL");
    }

    return response.json();
  }

  async uploadOverlayToS3(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed"));
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  }

  // Get presigned view URLs for saved overlay S3 keys
  async getOverlayViewUrls(
    teamId: number,
    clipId: number,
    s3Keys: string[]
  ): Promise<Record<string, string>> {
    const response = await apiFetch(
      `${API_URL}/clip-video/teams/${teamId}/clips/${clipId}/overlay-urls`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Keys }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get overlay URLs");
    }

    const data = await response.json();
    return data.urls;
  }
}

export const clipsAPI = new ClipsAPI();
