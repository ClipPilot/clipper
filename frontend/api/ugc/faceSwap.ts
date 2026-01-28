import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import type { FaceSwapJob } from "@/components/ugc-studio/types";

export interface CreateFaceSwapRequest {
  video: File;
  image: File;
  teamId: number;
  segments: Array<{ start: number; end: number }>;
  videoDuration: number;
  spliceWithOriginal?: boolean;
}

export interface CreateFaceSwapResponse {
  jobId: string;
}

export interface GetTeamJobsResponse {
  jobs: FaceSwapJob[];
  total: number;
  limit: number;
  offset: number;
}

class FaceSwapAPI {
  private baseUrl = `${API_URL}/c`;

  async createJob(data: CreateFaceSwapRequest): Promise<CreateFaceSwapResponse> {
    const result = await this.createMultipleJobs({
      video: data.video,
      images: [data.image],
      teamId: data.teamId,
      segments: data.segments,
      videoDuration: data.videoDuration,
      spliceWithOriginal: data.spliceWithOriginal,
    });

    return { jobId: result.jobIds[0] };
  }

  async getTeamJobs(teamId: number, options?: { limit?: number; offset?: number }): Promise<GetTeamJobsResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());

    const url = `${this.baseUrl}/team/${teamId}/jobs${params.toString() ? `?${params}` : ""}`;
    const response = await apiFetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch jobs");
    }

    return response.json();
  }

  async deleteJob(jobId: string): Promise<void> {
    const response = await apiFetch(`${this.baseUrl}/jobs/${jobId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete job");
    }
  }

  async updateJobTitle(jobId: string, title: string): Promise<void> {
    const response = await apiFetch(`${this.baseUrl}/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update job title");
    }
  }

  async downloadVideo(url: string, filename: string): Promise<Blob> {
    const downloadUrl = `${API_URL}/face-swap/download-fixed?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const response = await apiFetch(downloadUrl);

    if (!response.ok) {
      throw new Error("Download failed");
    }

    return response.blob();
  }

  async createMultipleJobs(data: {
    video: File;
    images: Array<File | { imageKey: string }>;
    teamId: number;
    segments: Array<{ start: number; end: number }>;
    videoDuration: number;
    spliceWithOriginal?: boolean;
    folderId?: number | null;
    voiceIds?: (string | null)[];
  }): Promise<{ jobIds: string[] }> {
    const { video, images, teamId, segments, videoDuration, spliceWithOriginal, folderId, voiceIds } = data;

    if (images.length === 0) {
      throw new Error("At least one image is required");
    }

    const idempotencyKey = crypto.randomUUID();

    const formData = new FormData();
    formData.append("video", video);

    const imageKeys: string[] = [];
    images.forEach((image) => {
      if (image instanceof File) {
        formData.append("images", image);
        imageKeys.push("");
      } else {
        imageKeys.push(image.imageKey);
      }
    });
    formData.append("imageKeys", JSON.stringify(imageKeys));

    formData.append("teamId", teamId.toString());
    formData.append("segments", JSON.stringify(segments));
    formData.append("videoDuration", videoDuration.toString());
    formData.append("spliceWithOriginal", String(spliceWithOriginal ?? true));
    formData.append("idempotencyKey", idempotencyKey);
    if (folderId != null) {
      formData.append("folderId", folderId.toString());
    }
    if (voiceIds && voiceIds.some((v) => v)) {
      formData.append("voiceIds", JSON.stringify(voiceIds));
    }

    console.log(`[FaceSwap] Uploading ${images.length} jobs to server...`);

    const response = await apiFetch(`${this.baseUrl}/ugc-face-swap-upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Failed to create jobs");
    }

    const result = await response.json();
    console.log(`[FaceSwap] Server accepted ${result.jobIds.length} jobs`);

    return { jobIds: result.jobIds };
  }

  async detectFaces(videoFile: File): Promise<{
    segments: Array<{ start: number; end: number }>;
    segmentCount: number;
  }> {
    const formData = new FormData();
    formData.append("video", videoFile);

    const response = await apiFetch(`${API_URL}/face-swap/detect-faces`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to detect faces" }));
      throw new Error(errorData.error || "Failed to detect faces");
    }

    return response.json();
  }

  async createMultipleJobsAutoDetect(data: {
    video: File;
    images: Array<File | { imageKey: string }>;
    teamId: number;
    videoDuration: number;
    spliceWithOriginal?: boolean;
    folderId?: number | null;
    voiceIds?: (string | null)[];
  }): Promise<{ jobIds: string[] }> {
    const { video, images, teamId, videoDuration, spliceWithOriginal, folderId, voiceIds } = data;

    if (images.length === 0) {
      throw new Error("At least one image is required");
    }

    const idempotencyKey = crypto.randomUUID();

    const formData = new FormData();
    formData.append("video", video);

    const imageKeys: string[] = [];
    images.forEach((image) => {
      if (image instanceof File) {
        formData.append("images", image);
        imageKeys.push("");
      } else {
        imageKeys.push(image.imageKey);
      }
    });
    formData.append("imageKeys", JSON.stringify(imageKeys));

    formData.append("teamId", teamId.toString());
    formData.append("videoDuration", videoDuration.toString());
    formData.append("spliceWithOriginal", String(spliceWithOriginal ?? true));
    formData.append("autoDetect", "true");
    formData.append("idempotencyKey", idempotencyKey);
    if (folderId != null) {
      formData.append("folderId", folderId.toString());
    }
    if (voiceIds && voiceIds.some((v) => v)) {
      formData.append("voiceIds", JSON.stringify(voiceIds));
    }

    console.log(`[FaceSwap] Uploading ${images.length} jobs with auto-detect...`);

    let lastError: Error | null = null;
    const maxRetries = 5;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[FaceSwap] Retry ${attempt}/${maxRetries} in ${delay / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const response = await apiFetch(`${this.baseUrl}/ugc-face-swap-upload`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: "Unknown error" }));
          const errorMsg = error.error || "Failed to create jobs";
          if (response.status >= 400 && response.status < 500) {
            throw new Error(errorMsg);
          }
          throw new Error(`Server error: ${errorMsg}`);
        }

        const result = await response.json();
        console.log(`[FaceSwap] Server accepted ${result.jobIds.length} jobs with auto-detect`);
        return { jobIds: result.jobIds };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Upload failed");
        console.warn(`[FaceSwap] Attempt ${attempt + 1} failed:`, lastError.message);

        if (
          lastError.message.includes("Insufficient credits") ||
          lastError.message.includes("PLAN_REQUIRED") ||
          lastError.message.includes("only available on") ||
          lastError.message.includes("Unauthorized")
        ) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error("Upload failed after retries");
  }
}

export const faceSwapAPI = new FaceSwapAPI();
