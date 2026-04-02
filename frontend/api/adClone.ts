import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import {
  VideoAnalysis,
  AdCloneProjectData,
  AdCloneProjectStatus,
} from "@/store/adClone";
import type {
  AdCloneCreateResponse,
  AdCloneUploadUrlsResponse,
  AdCloneProjectStatus as AdCloneProjectStatusResponse,
} from "@clipper/shared-types";

export type CreateProjectResponse = AdCloneCreateResponse;

export type UploadUrlsResponse = AdCloneUploadUrlsResponse;

export type ProjectStatusResponse = AdCloneProjectStatusResponse;

export interface ProjectResponse {
  success: boolean;
  project: AdCloneProjectData;
  analysis?: VideoAnalysis;
  scripts?: any[];
}

class AdCloneAPI {
  async initStructure(data: {
    projectId: string;
    message: string;
    productImageKeys?: string[];
    threadId?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  }): Promise<{
    success: boolean;
    responseType: "conversation" | "script";
    message: string;
    videoType: string;
    isSilent: boolean;
    character: boolean;
    targetAudience: string;
    title: string;
    totalDuration: number;
    scenes: any[];
  }> {
    const response = await apiFetch(`${API_URL}/ad-clone/init-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate structure");
    }

    return response.json();
  }

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

  async linkVideoJob(
    projectId: string,
    videoJobId: string
  ): Promise<{ success: boolean }> {
    const response = await apiFetch(
      `${API_URL}/ad-clone/${projectId}/link-video-job`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ videoJobId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to link video job");
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
