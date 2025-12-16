import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";

export interface PresignedUploadResponse {
  uploadUrl: string;
  s3Key: string;
}

export interface MultipartUploadResponse {
  uploadId: string;
  s3Key: string;
  chunkSize: number;
  totalParts: number;
  partUrls: { partNumber: number; uploadUrl: string }[];
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  remainingTime: number | null;
  speed: number;
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
            speed,
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

  async initiateMultipartUpload(
    teamId: number,
    fileName: string,
    contentType: string,
    fileSize: number
  ): Promise<MultipartUploadResponse> {
    const response = await apiFetch(`${API_URL}/clip-video/multipart/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, fileName, contentType, fileSize }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || "Failed to initiate upload");
    }

    return await response.json();
  }

  async uploadMultipart(
    file: File,
    multipartData: MultipartUploadResponse,
    onProgress?: (progress: UploadProgress) => void,
    concurrency: number = 4
  ): Promise<{ partNumber: number; etag: string }[]> {
    const { chunkSize, partUrls } = multipartData;
    const parts: { partNumber: number; etag: string }[] = [];
    const totalSize = file.size;
    const startTime = Date.now();
    const partProgress: Record<number, number> = {};

    const uploadPart = async (
      partInfo: { partNumber: number; uploadUrl: string }
    ): Promise<{ partNumber: number; etag: string }> => {
      const start = (partInfo.partNumber - 1) * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            partProgress[partInfo.partNumber] = event.loaded;
            const totalLoaded = Object.values(partProgress).reduce((a, b) => a + b, 0);

            if (onProgress) {
              const elapsed = (Date.now() - startTime) / 1000;
              const speed = elapsed > 0 ? totalLoaded / elapsed : 0;
              const remaining = totalSize - totalLoaded;
              const remainingTime = speed > 0 ? remaining / speed : null;

              onProgress({
                loaded: totalLoaded,
                total: totalSize,
                percentage: Math.round((totalLoaded / totalSize) * 100),
                remainingTime,
                speed,
              });
            }
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const etag = xhr.getResponseHeader("ETag");
            if (etag) {
              partProgress[partInfo.partNumber] = end - start;
              resolve({ partNumber: partInfo.partNumber, etag: etag.replace(/"/g, "") });
            } else {
              reject(new Error("No ETag received"));
            }
          } else {
            reject(new Error(`Part upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Part upload failed")));
        xhr.addEventListener("abort", () => reject(new Error("Part upload aborted")));

        xhr.open("PUT", partInfo.uploadUrl);
        xhr.send(chunk);
      });
    };

    const executeWithConcurrency = async <T>(
      items: T[],
      fn: (item: T) => Promise<any>,
      limit: number
    ): Promise<void> => {
      const executing: Promise<void>[] = [];

      for (const item of items) {
        const promise = fn(item).then((result) => {
          parts.push(result);
          executing.splice(executing.indexOf(promise), 1);
        });
        executing.push(promise);

        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }

      await Promise.all(executing);
    };

    await executeWithConcurrency(partUrls, uploadPart, concurrency);

    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  async completeMultipartUpload(
    s3Key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[]
  ): Promise<void> {
    const response = await apiFetch(`${API_URL}/clip-video/multipart/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s3Key, uploadId, parts }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || "Failed to complete upload");
    }
  }

  async abortMultipartUpload(s3Key: string, uploadId: string): Promise<void> {
    await apiFetch(`${API_URL}/clip-video/multipart/abort`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s3Key, uploadId }),
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
