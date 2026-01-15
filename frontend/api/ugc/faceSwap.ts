import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import type { FaceSwapJob, SwapType } from "@/components/ugc-studio/types";

export interface CreateFaceSwapRequest {
  video: File;
  image: File;
  teamId: number;
  segments: Array<{ start: number; end: number }>;
  videoDuration: number;
  swapType: SwapType;
  spliceWithOriginal?: boolean;
}

export interface CreateFaceSwapResponse {
  jobId: string;
}

export interface GetTeamJobsResponse {
  jobs: FaceSwapJob[];
}

class FaceSwapAPI {
  private baseUrl = `${API_URL}/c`;

  async createJob(
    data: CreateFaceSwapRequest
  ): Promise<CreateFaceSwapResponse> {
    const result = await this.createMultipleJobs({
      video: data.video,
      images: [data.image],
      teamId: data.teamId,
      segments: data.segments,
      videoDuration: data.videoDuration,
      swapType: data.swapType,
      spliceWithOriginal: data.spliceWithOriginal,
    });

    return { jobId: result.jobIds[0] };
  }

  async getTeamJobs(teamId: number): Promise<GetTeamJobsResponse> {
    const response = await apiFetch(`${this.baseUrl}/team/${teamId}/jobs`);

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
    images: File[];
    teamId: number;
    segments: Array<{ start: number; end: number }>;
    videoDuration: number;
    swapType: SwapType;
    spliceWithOriginal?: boolean;
  }): Promise<{ jobIds: string[] }> {
    const {
      video,
      images,
      teamId,
      segments,
      videoDuration,
      swapType,
      spliceWithOriginal,
    } = data;

    if (images.length === 0) {
      throw new Error("At least one image is required");
    }

    const idempotencyKey = crypto.randomUUID();

    // Build FormData for server upload
    const formData = new FormData();
    formData.append("video", video);
    images.forEach((image) => {
      formData.append("images", image);
    });
    formData.append("teamId", teamId.toString());
    formData.append("segments", JSON.stringify(segments));
    formData.append("videoDuration", videoDuration.toString());
    formData.append("swapType", swapType);
    formData.append("spliceWithOriginal", String(spliceWithOriginal ?? true));
    formData.append("idempotencyKey", idempotencyKey);

    console.log(`[FaceSwap] Uploading ${images.length} jobs to server...`);

    const response = await apiFetch(`${this.baseUrl}/ugc-face-swap-upload`, {
      method: "POST",
      body: formData,
      // No Content-Type header - browser sets it with boundary for multipart
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Failed to create jobs");
    }

    const result = await response.json();
    console.log(`[FaceSwap] Server accepted ${result.jobIds.length} jobs - you can leave the page now!`);

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
      const errorData = await response
        .json()
        .catch(() => ({ error: "Failed to detect faces" }));
      throw new Error(errorData.error || "Failed to detect faces");
    }

    return response.json();
  }

  async createMultipleJobsAutoDetect(data: {
    video: File;
    images: File[];
    teamId: number;
    videoDuration: number;
    swapType: SwapType;
    spliceWithOriginal?: boolean;
  }): Promise<{ jobIds: string[] }> {
    const { video, images, teamId, videoDuration, swapType, spliceWithOriginal } = data;

    if (images.length === 0) {
      throw new Error("At least one image is required");
    }

    const idempotencyKey = crypto.randomUUID();

    const formData = new FormData();
    formData.append("video", video);
    images.forEach((image) => {
      formData.append("images", image);
    });
    formData.append("teamId", teamId.toString());
    formData.append("videoDuration", videoDuration.toString());
    formData.append("swapType", swapType);
    formData.append("spliceWithOriginal", String(spliceWithOriginal ?? true));
    formData.append("autoDetect", "true");
    formData.append("idempotencyKey", idempotencyKey);

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
          const error = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          const errorMsg = error.error || "Failed to create jobs";
          if (response.status >= 400 && response.status < 500) {
            throw new Error(errorMsg);
          }
          throw new Error(`Server error: ${errorMsg}`);
        }

        const result = await response.json();
        console.log(`[FaceSwap] Server accepted ${result.jobIds.length} jobs with auto-detect - you can leave the page now!`);
        return { jobIds: result.jobIds };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Upload failed");
        console.warn(`[FaceSwap] Attempt ${attempt + 1} failed:`, lastError.message);

        if (lastError.message.includes("Insufficient credits") ||
            lastError.message.includes("PLAN_REQUIRED") ||
            lastError.message.includes("Unauthorized")) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error("Upload failed after retries");
  }
}

export const faceSwapAPI = new FaceSwapAPI();
