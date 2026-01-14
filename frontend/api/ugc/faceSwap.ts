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

interface UploadUrlsResponse {
  video: { uploadUrl: string; s3Key: string };
  image: { uploadUrl: string; s3Key: string };
}

class FaceSwapAPI {
  private baseUrl = `${API_URL}/c`;

  private async getUploadUrls(
    teamId: number,
    videoFileName: string,
    imageFileName: string
  ): Promise<UploadUrlsResponse> {
    const response = await apiFetch(`${this.baseUrl}/ugc-upload-urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, videoFileName, imageFileName }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Failed to get upload URLs");
    }

    return response.json();
  }

  private async uploadToS3(url: string, file: File): Promise<void> {
    const response = await fetch(url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.status}`);
    }
  }

  async createJob(data: CreateFaceSwapRequest): Promise<CreateFaceSwapResponse> {
    const idempotencyKey = crypto.randomUUID();
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retrying (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }

        console.log("[FaceSwap] Getting presigned upload URLs...");
        const urls = await this.getUploadUrls(
          data.teamId,
          data.video.name,
          data.image.name
        );

        console.log("[FaceSwap] Uploading video to S3...");
        await this.uploadToS3(urls.video.uploadUrl, data.video);

        console.log("[FaceSwap] Uploading image to S3...");
        await this.uploadToS3(urls.image.uploadUrl, data.image);

        console.log("[FaceSwap] Creating job with S3 keys...");
        const response = await apiFetch(`${this.baseUrl}/ugc-face-swap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId: data.teamId,
            videoS3Key: urls.video.s3Key,
            imageS3Key: urls.image.s3Key,
            segments: data.segments,
            videoDuration: data.videoDuration,
            swapType: data.swapType,
            spliceWithOriginal: data.spliceWithOriginal,
            idempotencyKey,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(error.error || "Failed to create job");
        }

        return response.json();
      } catch (err) {
        const isNetworkError = err instanceof TypeError;

        if (isNetworkError) {
          lastError = new Error("Network error - failed to connect. Retrying...");
        } else {
          lastError = err instanceof Error ? err : new Error("Upload failed");
        }

        if (isNetworkError && attempt < MAX_RETRIES) {
          console.warn(`Attempt ${attempt + 1} failed (network):`, lastError.message);
          continue;
        }

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
    const { video, images, teamId, segments, videoDuration, swapType, spliceWithOriginal } = data;

    if (images.length === 0) {
      throw new Error("At least one image is required");
    }

    console.log(`[FaceSwap] Creating ${images.length} jobs...`);

    // Step 1: Get upload URL and upload video once (using first image to get URLs)
    const firstUrls = await this.getUploadUrls(teamId, video.name, images[0].name);

    console.log("[FaceSwap] Uploading video to S3...");
    await this.uploadToS3(firstUrls.video.uploadUrl, video);

    const videoS3Key = firstUrls.video.s3Key;

    // Step 2: Upload all images and create jobs
    const jobIds: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const idempotencyKey = crypto.randomUUID();

      let imageS3Key: string;

      if (i === 0) {
        // First image already has upload URL
        console.log(`[FaceSwap] Uploading image ${i + 1}/${images.length} to S3...`);
        await this.uploadToS3(firstUrls.image.uploadUrl, image);
        imageS3Key = firstUrls.image.s3Key;
      } else {
        // Get new upload URL for additional images
        const imageUrls = await this.getUploadUrls(teamId, video.name, image.name);
        console.log(`[FaceSwap] Uploading image ${i + 1}/${images.length} to S3...`);
        await this.uploadToS3(imageUrls.image.uploadUrl, image);
        imageS3Key = imageUrls.image.s3Key;
      }

      // Create job with the same video but different image
      console.log(`[FaceSwap] Creating job ${i + 1}/${images.length}...`);
      const response = await apiFetch(`${this.baseUrl}/ugc-face-swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          videoS3Key,
          imageS3Key,
          segments,
          videoDuration,
          swapType,
          spliceWithOriginal,
          idempotencyKey,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || `Failed to create job ${i + 1}`);
      }

      const result = await response.json();
      jobIds.push(result.jobId);
    }

    console.log(`[FaceSwap] Successfully created ${jobIds.length} jobs`);
    return { jobIds };
  }

  async detectFaces(videoFile: File): Promise<{ segments: Array<{ start: number; end: number }>; segmentCount: number }> {
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
}

export const faceSwapAPI = new FaceSwapAPI();
