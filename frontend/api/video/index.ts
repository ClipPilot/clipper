import API_URL from "@/config/constants";
import { apiFetch } from "@/lib/apiClient";
import { PromptType } from "@/constants/promptTypes";

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

export type ConversionMode = "standard" | "gaming" | "speaker-zoom" | "center-crop" | "active-speaker";

export interface SubmitClipParams {
  teamId: number;
  s3Key: string;
  originalFileName?: string;
  fileSize?: number;
  length?: number;
  hookLength?: number;
  promptType?: PromptType;
  customPrompt?: string;
  numberOfVideos?: number;
  customText?: string;
  textPosition?: "top" | "middle" | "bottom";
  textColor?: string;
  textFont?: string;
  captions?: boolean;
  captionColor?: string;
  captionFont?: string;
  conversionMode?: ConversionMode;
  textStyle?: "stroke" | "instagram";
  textBgColor?: string;
  autoHeading?: boolean;
  headingInstructions?: string;
  backgroundMusicS3Key?: string;
}

export interface SubmitClipResponse {
  clipIds: number[];
  message: string;
  status: string;
}

// Batch upload types
export interface BatchUploadedVideo {
  s3Key: string;
  fileName: string;
  fileSize: number;
  videoIndex: number; // 0-4
  duration: number; // Duration in seconds
}

export interface SubmitBatchClipParams {
  teamId: number;
  videos: Array<{
    s3Key: string;
    videoIndex: number;
    originalFileName?: string;
    fileSize?: number;
    duration: number; // Duration in seconds
  }>;
  length?: number;
  hookLength?: number;
  promptType?: PromptType;
  customPrompt?: string;
  textPrompt?: string;
  numberOfVideos?: number;
  customText?: string;
  textPosition?: "top" | "middle" | "bottom";
  textColor?: string;
  textFont?: string;
  captions?: boolean;
  captionColor?: string;
  captionFont?: string;
  conversionMode?: ConversionMode;
  textStyle?: "stroke" | "instagram";
  textBgColor?: string;
  autoHeading?: boolean;
  headingInstructions?: string;
  backgroundMusicS3Key?: string;
}

export interface VideoUrlInfo {
  title: string;
  duration: number;
  filesize: number;
  thumbnail: string;
  uploader: string;
  platform: string;
}

export interface VideoDownloadProgress {
  type: "start" | "progress" | "uploading" | "complete" | "error";
  message?: string;
  percent?: number;
  speed?: string;
  eta?: string;
  s3Key?: string;
  fileName?: string;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
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
      throw new Error(
        error.message || error.error || "Failed to get upload URL"
      );
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

  private uploadSinglePart(
    file: File,
    partInfo: { partNumber: number; uploadUrl: string },
    chunkSize: number,
    partProgress: Record<number, number>,
    totalSize: number,
    startTime: number,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ partNumber: number; etag: string }> {
    const start = (partInfo.partNumber - 1) * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    const chunkSizeBytes = end - start;

    const timeoutMs = Math.max(
      10 * 60 * 1000,
      Math.ceil(chunkSizeBytes / (1024 * 1024)) * 60 * 1000 // +60s per MB
    );

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          partProgress[partInfo.partNumber] = event.loaded;
          const totalLoaded = Object.values(partProgress).reduce(
            (a, b) => a + b,
            0
          );

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
        // IMPORTANT: treat 404 as fatal (uploadId invalid / aborted / expired)
        if (xhr.status === 404) {
          reject(new Error("FATAL_UPLOAD_INVALIDATED"));
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          if (etag) {
            // mark full part complete
            partProgress[partInfo.partNumber] = chunkSizeBytes;
            resolve({
              partNumber: partInfo.partNumber,
              etag: etag.replace(/"/g, ""),
            });
          } else {
            reject(new Error("No ETag received"));
          }
        } else {
          reject(new Error(`Part upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        // Network reset / connection issues land here in many browsers
        reject(new Error("Part upload failed - connection error"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Part upload aborted"));
      });

      xhr.addEventListener("timeout", () => {
        reject(new Error("Part upload timed out"));
      });

      xhr.open("PUT", partInfo.uploadUrl);
      xhr.timeout = timeoutMs;

      // Safer with many presign configs; does NOT hurt when not signed.
      // If your presign signs Content-Type, this is required.
      try {
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
      } catch {
        // ignore if browser disallows (rare)
      }

      xhr.send(chunk);
    });
  }

  async initiateMultipartUpload(
    teamId: number,
    fileName: string,
    contentType: string,
    fileSize: number
  ): Promise<MultipartUploadResponse> {
    const response = await apiFetch(
      `${API_URL}/clip-video/multipart/initiate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, fileName, contentType, fileSize }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || error.error || "Failed to initiate upload"
      );
    }

    return await response.json();
  }
  async uploadMultipart(
    file: File,
    multipartData: MultipartUploadResponse,
    onProgress?: (progress: UploadProgress) => void,
    concurrency: number | "auto" = "auto"
  ): Promise<{ partNumber: number; etag: string }[]> {
    const { chunkSize, partUrls, s3Key, uploadId } = multipartData;
    const parts: { partNumber: number; etag: string }[] = [];
    const totalSize = file.size;
    const startTime = Date.now();
    const partProgress: Record<number, number> = {};

    // Track retry counts per part to avoid infinite loops on flaky networks
    const retryCount = new Map<number, number>();

    const uploadPartWithRetry = async (
      partInfo: { partNumber: number; uploadUrl: string },
      maxRetries: number = 3
    ): Promise<{ partNumber: number; etag: string }> => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await this.uploadSinglePart(
            file,
            partInfo,
            chunkSize,
            partProgress,
            totalSize,
            startTime,
            onProgress
          );
        } catch (error: any) {
          // If uploadId is dead, stop everything immediately
          if (error?.message === "FATAL_UPLOAD_INVALIDATED") {
            throw error;
          }

          const prev = retryCount.get(partInfo.partNumber) ?? 0;
          retryCount.set(partInfo.partNumber, prev + 1);

          // Exponential backoff, a bit longer helps Comcast resets recover
          if (attempt < maxRetries - 1) {
            const delay = 1500 * Math.pow(2, attempt); // 1.5s, 3s, 6s
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }

      throw new Error(
        `Part ${partInfo.partNumber} failed after ${maxRetries} attempts`
      );
    };

    const executeWithConcurrency = async <T>(
      items: T[],
      fn: (item: T) => Promise<any>,
      limit: number
    ): Promise<void> => {
      const executing: Promise<void>[] = [];

      for (const item of items) {
        const p = fn(item).then((result) => {
          parts.push(result);
          executing.splice(executing.indexOf(p), 1);
        });
        executing.push(p);

        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }

      await Promise.all(executing);
    };

    // Determine concurrency (be conservative on unstable networks)
    let effectiveConcurrency: number;

    try {
      if (concurrency === "auto") {
        // Probe first part; if it retries or is slow, use low concurrency
        const firstPart = partUrls[0];
        const measureStart = Date.now();

        // Probe with 3 retries
        const firstResult = await uploadPartWithRetry(firstPart, 3);
        parts.push(firstResult);

        const measureTime = (Date.now() - measureStart) / 1000;
        const firstChunkSize = Math.min(chunkSize, file.size);
        const speedMBps = firstChunkSize / measureTime / (1024 * 1024);

        const firstPartRetries = retryCount.get(firstPart.partNumber) ?? 0;
        const unstable = firstPartRetries > 0 || speedMBps < 5;

        // Comcast/Xfinity tends to behave better with lower concurrency when unstable
        effectiveConcurrency = unstable
          ? 2
          : speedMBps < 20
            ? 3
            : speedMBps < 50
              ? 4
              : 6;

        // Upload the rest
        const remainingParts = partUrls.slice(1);
        if (remainingParts.length > 0) {
          await executeWithConcurrency(
            remainingParts,
            (p) => uploadPartWithRetry(p as any, 3),
            effectiveConcurrency
          );
        }
      } else {
        effectiveConcurrency = Math.max(1, concurrency);
        await executeWithConcurrency(
          partUrls,
          (p) => uploadPartWithRetry(p as any, 3),
          effectiveConcurrency
        );
      }
    } catch (err: any) {
      // If we ever hit fatal invalidation, abort the multipart upload server-side
      if (err?.message === "FATAL_UPLOAD_INVALIDATED") {
        await this.abortMultipartUpload(s3Key, uploadId);
        throw new Error(
          "Multipart upload invalidated (uploadId expired/aborted). Please retry."
        );
      }
      // For other hard failures, also abort to prevent stuck multipart uploads
      await this.abortMultipartUpload(s3Key, uploadId);
      throw err;
    }

    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  async completeMultipartUpload(
    s3Key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[]
  ): Promise<void> {
    const response = await apiFetch(
      `${API_URL}/clip-video/multipart/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Key, uploadId, parts }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || error.error || "Failed to complete upload"
      );
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

  async submitBatchClipJob(
    params: SubmitBatchClipParams
  ): Promise<SubmitClipResponse> {
    const response = await apiFetch(`${API_URL}/clip-video/batch-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || error.error || "Failed to submit batch job"
      );
    }

    return await response.json();
  }

  async getVideoInfo(url: string): Promise<VideoUrlInfo> {
    const response = await apiFetch(`${API_URL}/clip-video/url/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || error.error || "Failed to get video info"
      );
    }

    return await response.json();
  }

  async downloadFromUrl(
    url: string,
    teamId: number,
    onProgress?: (progress: VideoDownloadProgress) => void
  ): Promise<{ s3Key: string; fileName: string; fileSize: number; downloadUrl?: string }> {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_URL}/clip-video/url/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url, teamId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || error.error || "Failed to download video"
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let result: { s3Key: string; fileName: string; fileSize: number; downloadUrl?: string } | null =
      null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6)) as VideoDownloadProgress;
            if (onProgress) onProgress(data);

            if (data.type === "complete" && data.s3Key) {
              result = {
                s3Key: data.s3Key,
                fileName: data.fileName || "video.mp4",
                fileSize: data.fileSize || 0,
                downloadUrl: data.downloadUrl,
              };
            }

            if (data.type === "error") {
              throw new Error(data.error || "Download failed");
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }

    if (!result) throw new Error("Download completed but no result received");
    return result;
  }
}

export const videoAPI = new VideoAPI();
