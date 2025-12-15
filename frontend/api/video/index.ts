import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface PresignedUploadResponse {
  uploadUrl: string;
  s3Key: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  remainingTime: number | null;
}

export interface SubmitClipParams {
  teamId: number;
  s3Key: string;
  originalFileName?: string;
  fileSize?: number;
  length?: number;
  hookLength?: number;
  promptType?: "business" | "viral";
  customPrompt?: string;
  numberOfVideos?: number;
  customText?: string;
  textPosition?: "top" | "middle" | "bottom";
  textColor?: string;
  captions?: boolean;
  captionColor?: string;
  captionFont?: string;
}

export interface SubmitClipResponse {
  clipIds: number[];
  message: string;
  status: string;
}

class VideoAPI {
  async getPresignedUploadUrl(
    teamId: number,
    fileName: string,
    contentType: string,
    fileSize: number
  ): Promise<PresignedUploadResponse> {
    const response = await apiFetch(`${API_URL}/clip-video/presigned-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, fileName, contentType, fileSize }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || "Failed to get upload URL");
    }

    return await response.json();
  }

  async uploadToS3(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = event.loaded / elapsed;
          const remaining = event.total - event.loaded;
          const remainingTime = speed > 0 ? remaining / speed : null;

          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
            remainingTime,
          });
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

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"));
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  }

  async submitClipJob(params: SubmitClipParams): Promise<SubmitClipResponse> {
    const response = await apiFetch(`${API_URL}/clip-video/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || "Failed to submit job");
    }

    return await response.json();
  }
}

export const videoAPI = new VideoAPI();
