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

  async createJob(data: CreateFaceSwapRequest): Promise<CreateFaceSwapResponse> {
    const formData = new FormData();
    formData.append("video", data.video);
    formData.append("image", data.image);
    formData.append("teamId", data.teamId.toString());
    formData.append("segments", JSON.stringify(data.segments));
    formData.append("videoDuration", data.videoDuration.toString());
    formData.append("swapType", data.swapType);
    formData.append("spliceWithOriginal", data.spliceWithOriginal ? "true" : "false");

    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 3000;
    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retrying upload (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }

        response = await apiFetch(`${this.baseUrl}/ugc-face-swap`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          const err = new Error(error.error || "Failed to create face swap job");
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            throw err;
          }
          throw err;
        }

        return response.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Upload failed");
        const isNetworkError = err instanceof TypeError;
        const isServerError = response && response.status >= 500;
        if (!isNetworkError && !isServerError) {
          break;
        }
        if (attempt < MAX_RETRIES) {
          console.warn(`Upload attempt ${attempt + 1} failed:`, lastError.message);
        }
      }
    }

    throw lastError || new Error("Upload failed after retries");
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
}

export const faceSwapAPI = new FaceSwapAPI();
