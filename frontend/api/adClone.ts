import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import {
  VideoAnalysis,
  AdCloneProjectData,
  AdCloneProjectStatus,
} from "@/store/adClone";

export interface CreateProjectResponse {
  success: boolean;
  projectId: string;
  uploadUrls: {
    video: { uploadUrl: string; s3Key: string };
    productImages: { uploadUrl: string; s3Key: string }[];
  };
}

export interface UploadUrlsResponse {
  success: boolean;
  uploadUrls: {
    video: { uploadUrl: string; s3Key: string };
    productImages: { uploadUrl: string; s3Key: string }[];
  };
}

export interface ProjectStatusResponse {
  success: boolean;
  projectId: string;
  status: AdCloneProjectStatus;
  progress: number;
  progressMessage: string | null;
  hasAnalysis?: boolean;
  hasScript?: boolean;
  script?: any;
  finalVideoUrl?: string;
  error?: string;
}

export interface ProjectResponse {
  success: boolean;
  project: AdCloneProjectData;
  analysis?: VideoAnalysis;
  scripts?: any[];
}

class AdCloneAPI {
  async createProject(data: {
    teamId: number;
    productName?: string;
    productDescription?: string;
    adDirection?: string;
  }): Promise<CreateProjectResponse> {
    const response = await apiFetch(`${API_URL}/ad-clone/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create project");
    }

    return response.json();
  }

  async getUploadUrls(data: {
    teamId: number;
    projectId: string;
    videoFileName: string;
    productImageFileNames?: string[];
  }): Promise<UploadUrlsResponse> {
    const response = await apiFetch(`${API_URL}/ad-clone/upload-urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get upload URLs");
    }

    return response.json();
  }

  async confirmUpload(
    projectId: string,
    data: {
      referenceVideoKey: string;
      productImageKeys?: string[];
    }
  ): Promise<{ success: boolean }> {
    const response = await apiFetch(
      `${API_URL}/ad-clone/${projectId}/confirm-upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to confirm upload");
    }

    return response.json();
  }

  async startAnalysis(
    projectId: string,
    teamId: number
  ): Promise<{ success: boolean; projectId: string; status: string }> {
    const response = await apiFetch(
      `${API_URL}/ad-clone/${projectId}/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teamId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to start analysis");
    }

    return response.json();
  }

  async startAnalyzeAndScript(
    projectId: string,
    teamId: number
  ): Promise<{ success: boolean; projectId: string; status: string }> {
    const response = await apiFetch(
      `${API_URL}/ad-clone/${projectId}/analyze-and-script`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teamId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to start processing");
    }

    return response.json();
  }

  async getAnalysis(
    projectId: string
  ): Promise<{
    success: boolean;
    projectId: string;
    status: string;
    analysis: VideoAnalysis | null;
  }> {
    const response = await apiFetch(
      `${API_URL}/ad-clone/${projectId}/analysis`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get analysis");
    }

    return response.json();
  }

  async generateScript(
    projectId: string,
    data: { teamId: number; characterId: number }
  ): Promise<{ success: boolean; projectId: string; status: string }> {
    const response = await apiFetch(
      `${API_URL}/ad-clone/${projectId}/generate-script`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate script");
    }

    return response.json();
  }

  async updateScript(
    projectId: string,
    data: { script: any; selectedVariantIndex?: number }
  ): Promise<{ success: boolean }> {
    const response = await apiFetch(
      `${API_URL}/ad-clone/${projectId}/script`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update script");
    }

    return response.json();
  }

  async generateVideo(
    projectId: string,
    data: { teamId: number; voiceId: string; characterId: number }
  ): Promise<{
    success: boolean;
    projectId: string;
    videoJobId: string;
    status: string;
  }> {
    const response = await apiFetch(
      `${API_URL}/ad-clone/${projectId}/generate-video`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate video");
    }

    return response.json();
  }

  async getStatus(projectId: string): Promise<ProjectStatusResponse> {
    const response = await apiFetch(
      `${API_URL}/ad-clone/${projectId}/status`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get status");
    }

    return response.json();
  }

  async getProject(projectId: string): Promise<ProjectResponse> {
    const response = await apiFetch(`${API_URL}/ad-clone/${projectId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get project");
    }

    return response.json();
  }

  async deleteProject(projectId: string): Promise<{ success: boolean }> {
    const response = await apiFetch(`${API_URL}/ad-clone/${projectId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete project");
    }

    return response.json();
  }

  async listProjects(
    teamId: number,
    limit = 20,
    offset = 0
  ): Promise<{
    success: boolean;
    projects: Array<{
      id: string;
      productName: string | null;
      status: AdCloneProjectStatus;
      progress: number;
      progressMessage: string | null;
      thumbnailUrl?: string;
      finalVideoUrl?: string;
      createdAt: string;
      updatedAt: string;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const params = new URLSearchParams({
      teamId: teamId.toString(),
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await apiFetch(
      `${API_URL}/ad-clone/projects?${params}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list projects");
    }

    return response.json();
  }

  async finalizeProject(
    projectId: string,
    data: { teamId: number; folderId?: number }
  ): Promise<{ success: boolean; clipId: number; message: string }> {
    const response = await apiFetch(
      `${API_URL}/ad-clone/${projectId}/finalize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to finalize project");
    }

    return response.json();
  }

  async uploadFile(
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
}

export const adCloneAPI = new AdCloneAPI();
