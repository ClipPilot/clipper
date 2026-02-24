import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { s3Service } from "./s3.service";
import { getApifyService } from "./virality/apify.service";

export interface VideoInfo {
  title: string;
  duration: number;
  filesize: number;
  thumbnail: string;
  uploader: string;
  platform: string;
}

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
}

const OUTPUT_DIR = path.resolve(__dirname, "../../output");
const INFO_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const FORMAT_SELECTION = [
  "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]",
  "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]",
  "bestvideo[ext=mp4][height<=480]+bestaudio[ext=m4a]",
  "best[ext=mp4][height<=1080]",
  "best[ext=mp4][height<=720]",
  "best",
].join("/");

const COOKIES_FILE = process.env.YTDLP_COOKIES_FILE || "";
const MAX_FILESIZE = process.env.YTDLP_MAX_FILESIZE || "2G";

function baseYtDlpArgs(): string[] {
  const args = ["--js-runtimes", "nodejs", "--max-filesize", MAX_FILESIZE];
  if (COOKIES_FILE && fs.existsSync(COOKIES_FILE)) {
    args.push("--cookies", COOKIES_FILE);
  }
  return args;
}

function isInstagramUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return hostname === "instagram.com" || hostname === "instagr.am";
  } catch {
    return false;
  }
}


class VideoDownloadService {
  async getVideoInfo(url: string): Promise<VideoInfo> {
    if (isInstagramUrl(url)) {
      const reel = await getApifyService().scrapeInstagramReel(url);
      return {
        title: reel.title,
        duration: reel.duration,
        filesize: 0,
        thumbnail: reel.thumbnail,
        uploader: reel.uploader,
        platform: "Instagram",
      };
    }

    return new Promise((resolve, reject) => {
      const args = [...baseYtDlpArgs(), "--dump-json", "--no-download", url];
      const proc = spawn("yt-dlp", args);

      let stdout = "";
      let stderr = "";

      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error("Timed out fetching video info"));
      }, INFO_TIMEOUT_MS);

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const msg = stderr.trim() || `yt-dlp exited with code ${code}`;
          return reject(new Error(msg));
        }

        try {
          const info = JSON.parse(stdout);
          resolve({
            title: info.title || "Untitled",
            duration: info.duration || 0,
            filesize: info.filesize_approx || info.filesize || 0,
            thumbnail: info.thumbnail || "",
            uploader: info.uploader || info.channel || "",
            platform: info.extractor_key || info.extractor || "Unknown",
          });
        } catch {
          reject(new Error("Failed to parse video info"));
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
      });
    });
  }

  async downloadToS3(
    url: string,
    teamId: number,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ s3Key: string; fileName: string; fileSize: number }> {
    if (isInstagramUrl(url)) {
      return this.downloadInstagramToS3(url, teamId, onProgress);
    }

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const outputTemplate = path.join(
      OUTPUT_DIR,
      `${teamId}_${Date.now()}_%(title).50s.%(ext)s`
    );

    const args = [
      ...baseYtDlpArgs(),
      "-f",
      FORMAT_SELECTION,
      "--merge-output-format",
      "mp4",
      "--newline",
      "--progress-template",
      "download:%(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s",
      "-o",
      outputTemplate,
      url,
    ];

    let downloadedFilePath: string | null = null;

    try {
      downloadedFilePath = await new Promise<string>((resolve, reject) => {
        const proc = spawn("yt-dlp", args);

        let stderr = "";
        let lastFilePath = "";

        const timer = setTimeout(() => {
          proc.kill("SIGTERM");
          reject(new Error("Download timed out"));
        }, DOWNLOAD_TIMEOUT_MS);

        proc.stdout.on("data", (data: Buffer) => {
          const lines = data.toString().split("\n");
          for (const line of lines) {
            const trimmed = line.trim();

            // Parse progress lines: "download: 45.2%  5.2MiB/s  00:23"
            if (trimmed.startsWith("download:") && onProgress) {
              const parts = trimmed.replace("download:", "").trim().split(/\s+/);
              if (parts.length >= 1) {
                const percentStr = parts[0]?.replace("%", "").trim();
                const percent = parseFloat(percentStr) || 0;
                onProgress({
                  percent: Math.min(percent, 100),
                  speed: parts[1] || "N/A",
                  eta: parts[2] || "N/A",
                });
              }
            }

            // Detect destination/merge lines to capture final file path
            const destMatch = trimmed.match(
              /(?:\[download\] Destination:|(?:\[Merger\]|Merging formats into) )"?(.+\.mp4)"?/
            );
            if (destMatch) {
              lastFilePath = destMatch[1].replace(/^"|"$/g, "");
            }

            // Also detect "[download] <path> has already been downloaded"
            const alreadyMatch = trimmed.match(
              /\[download\] (.+\.mp4) has already been downloaded/
            );
            if (alreadyMatch) {
              lastFilePath = alreadyMatch[1];
            }
          }
        });

        proc.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          clearTimeout(timer);
          if (code !== 0) {
            const msg = stderr.trim() || `yt-dlp exited with code ${code}`;
            return reject(new Error(msg));
          }

          if (lastFilePath && fs.existsSync(lastFilePath)) {
            return resolve(lastFilePath);
          }

          // Fallback: scan output dir for recently created mp4 files
          const files = fs.readdirSync(OUTPUT_DIR)
            .filter((f) => f.startsWith(`${teamId}_`) && f.endsWith(".mp4"))
            .map((f) => ({
              name: f,
              path: path.join(OUTPUT_DIR, f),
              mtime: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs,
            }))
            .sort((a, b) => b.mtime - a.mtime);

          if (files.length > 0) {
            return resolve(files[0].path);
          }

          reject(new Error("Download completed but output file not found"));
        });

        proc.on("error", (err) => {
          clearTimeout(timer);
          reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
        });
      });

      // Upload to S3
      const fileName = path.basename(downloadedFilePath);
      const fileSize = fs.statSync(downloadedFilePath).size;
      const s3Key = await s3Service.uploadRawVideo(downloadedFilePath, teamId);

      return { s3Key, fileName, fileSize };
    } finally {
      // Always clean up temp file
      if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
        try {
          fs.unlinkSync(downloadedFilePath);
        } catch {
          // Best effort cleanup
        }
      }
    }
  }
  async downloadToPath(url: string, outputPath: string): Promise<void> {
    if (isInstagramUrl(url)) {
      const reel = await getApifyService().scrapeInstagramReel(url);
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      await s3Service.downloadVideoFromUrl(reel.videoUrl, outputPath);
      return;
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const args = [
        ...baseYtDlpArgs(),
        "-f", FORMAT_SELECTION,
        "--merge-output-format", "mp4",
        "-o", outputPath,
        url,
      ];
      const proc = spawn("yt-dlp", args);

      let stderr = "";

      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error("Download timed out"));
      }, DOWNLOAD_TIMEOUT_MS);

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const msg = stderr.trim() || `yt-dlp exited with code ${code}`;
          return reject(new Error(msg));
        }
        if (!fs.existsSync(outputPath)) {
          return reject(new Error("Download completed but output file not found"));
        }
        resolve();
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
      });
    });
  }
  private async downloadInstagramToS3(
    url: string,
    teamId: number,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ s3Key: string; fileName: string; fileSize: number }> {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const reel = await getApifyService().scrapeInstagramReel(url);

    onProgress?.({ percent: 50, speed: "N/A", eta: "N/A" });

    const localPath = path.join(
      OUTPUT_DIR,
      `${teamId}_${Date.now()}_instagram_reel.mp4`
    );

    try {
      await s3Service.downloadVideoFromUrl(reel.videoUrl, localPath);

      onProgress?.({ percent: 90, speed: "N/A", eta: "N/A" });

      const fileName = path.basename(localPath);
      const fileSize = fs.statSync(localPath).size;
      const s3Key = await s3Service.uploadRawVideo(localPath, teamId);

      onProgress?.({ percent: 100, speed: "N/A", eta: "N/A" });

      return { s3Key, fileName, fileSize };
    } finally {
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch {
          // Best effort cleanup
        }
      }
    }
  }
}

export const videoDownloadService = new VideoDownloadService();
