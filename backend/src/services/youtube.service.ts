interface VideoInfo {
  title: string;
  duration: number;
  filesize: number;
  thumbnail: string;
  uploader: string;
}

interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  downloaded: number;
  total: number;
}

interface LambdaDownloadResult {
  s3Key: string;
  fileName: string;
  fileSize: number;
  bucket: string;
}

class YouTubeService {
  private lambdaUrl: string;
  private environment: string;

  constructor() {
    this.lambdaUrl = process.env.YOUTUBE_LAMBDA_URL || "";
    this.environment = process.env.APP_ENVIRONMENT || "prod";
  }

  private isValidYouTubeUrl(url: string): boolean {
    const patterns = [
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
      /^(https?:\/\/)?youtu\.be\/[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    if (!this.isValidYouTubeUrl(url)) {
      throw new Error("Invalid YouTube URL");
    }

    if (!this.lambdaUrl) {
      throw new Error("YouTube Lambda URL not configured");
    }

    const response = await fetch(this.lambdaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "info", url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get video info");
    }

    return await response.json();
  }

  async downloadAndUploadToS3(
    url: string,
    teamId: number,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ s3Key: string; fileName: string; fileSize: number }> {
    if (!this.isValidYouTubeUrl(url)) {
      throw new Error("Invalid YouTube URL");
    }

    if (!this.lambdaUrl) {
      throw new Error("YouTube Lambda URL not configured");
    }

    if (onProgress) {
      onProgress({
        percent: 0,
        speed: "Starting...",
        eta: "Calculating...",
        downloaded: 0,
        total: 0,
      });
    }

    const response = await fetch(this.lambdaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "download",
        url,
        teamId,
        environment: this.environment,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to download video");
    }

    const result: LambdaDownloadResult = await response.json();

    if (onProgress) {
      onProgress({
        percent: 100,
        speed: "Complete",
        eta: "0:00",
        downloaded: result.fileSize,
        total: result.fileSize,
      });
    }

    return {
      s3Key: result.s3Key,
      fileName: result.fileName,
      fileSize: result.fileSize,
    };
  }
}

export const youtubeService = new YouTubeService();
