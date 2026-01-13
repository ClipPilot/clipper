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
    const idempotencyKey = crypto.randomUUID();

    formData.append("video", data.video);
    formData.append("image", data.image);
    formData.append("teamId", data.teamId.toString());
    formData.append("segments", JSON.stringify(data.segments));
    formData.append("videoDuration", data.videoDuration.toString());
    formData.append("swapType", data.swapType);
    formData.append("spliceWithOriginal", data.spliceWithOriginal ? "true" : "false");
    formData.append("idempotencyKey", idempotencyKey);

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;
    const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for large video uploads
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
      let response: Response | null = null;

      try {
        if (attempt > 0) {
          console.log(`Retrying upload (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }

        response = await apiFetch(`${this.baseUrl}/ugc-face-swap`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: "Unknown error" }));
          const err = new Error(error.error || "Failed to create face swap job");

          // Retry on 5xx server errors
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            console.warn(`Server error ${response.status}, will retry...`);
            lastError = err;
            continue;
          }
          throw err;
        }

        return response.json();
      } catch (err) {
        clearTimeout(timeoutId);

        // Detect timeout/abort errors
        const isAbortError = err instanceof Error && err.name === "AbortError";
        const isNetworkError = err instanceof TypeError || isAbortError;

        if (isAbortError) {
          lastError = new Error("Upload timed out - please check your network connection");
        } else if (err instanceof TypeError) {
          lastError = new Error("Network error - failed to connect. Retrying...");
        } else {
          lastError = err instanceof Error ? err : new Error("Upload failed");
        }

        // Only retry on network errors or if we haven't exhausted retries
        if (isNetworkError && attempt < MAX_RETRIES) {
          console.warn(`Upload attempt ${attempt + 1} failed (network):`, lastError.message);
          continue;
        }

        // Non-retryable error (4xx client error, etc.)
        if (!isNetworkError) {
          throw lastError;
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
