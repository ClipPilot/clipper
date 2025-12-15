import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { config } from "../config/env";

const s3Client = new S3Client({
  region: config.aws.region,
});

const BUCKET_NAME = config.aws.s3Bucket;
const GENERATED_CLIPS_FOLDER = "generated-clips";
const BLANK_CLIPS_FOLDER = "blank-clips";
const SRT_FOLDER = "srt-files";
const THUMBNAILS_FOLDER = "thumbnails";
const RAW_VIDEOS_FOLDER = "raw-videos";

const MULTIPART_THRESHOLD = 50 * 1024 * 1024;
const PART_SIZE = 10 * 1024 * 1024;
const QUEUE_SIZE = 4;

class S3Service {
  private async multipartUpload(
    filePath: string,
    key: string,
    contentType: string
  ): Promise<string> {
    const fileSize = fs.statSync(filePath).size;
    const fileStream = fs.createReadStream(filePath);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
      },
      queueSize: QUEUE_SIZE,
      partSize: PART_SIZE,
      leavePartsOnError: false,
    });

    upload.on("httpUploadProgress", (progress) => {
      if (progress.loaded && progress.total) {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        if (percent % 20 === 0) {
          console.log(`[S3] Upload progress: ${percent}% (${Math.round(progress.loaded / 1024 / 1024)}MB / ${Math.round(progress.total / 1024 / 1024)}MB)`);
        }
      }
    });

    await upload.done();
    console.log(`[S3] Multipart upload complete: ${key} (${Math.round(fileSize / 1024 / 1024)}MB)`);
    return key;
  }

  async uploadRawVideo(filePath: string, teamId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${Date.now()}_${path.basename(filePath)}`;
      const key = `${RAW_VIDEOS_FOLDER}/${fileName}`;
      const fileSize = fs.statSync(filePath).size;

      console.log(`[S3] Uploading raw video: ${Math.round(fileSize / 1024 / 1024)}MB`);

      if (fileSize > MULTIPART_THRESHOLD) {
        return await this.multipartUpload(filePath, key, "video/mp4");
      }

      return await this.multipartUpload(filePath, key, "video/mp4");
    } catch (error) {
      console.error("Error uploading raw video to S3:", error);
      throw new Error(`Failed to upload raw video to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async uploadThumbnail(filePath: string, teamId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${Date.now()}_${path.basename(filePath)}`;
      const key = `${THUMBNAILS_FOLDER}/${fileName}`;

      return await this.multipartUpload(filePath, key, "image/jpeg");
    } catch (error) {
      console.error("Error uploading thumbnail to S3:", error);
      throw new Error(`Failed to upload thumbnail to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async uploadGeneratedClip(filePath: string, teamId: number, clipId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${clipId}_${Date.now()}.mp4`;
      const key = `${GENERATED_CLIPS_FOLDER}/${fileName}`;

      return await this.multipartUpload(filePath, key, "video/mp4");
    } catch (error) {
      console.error("Error uploading generated clip to S3:", error);
      throw new Error(`Failed to upload generated clip to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async uploadBlankClip(filePath: string, teamId: number, clipId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${clipId}_${Date.now()}.mp4`;
      const key = `${BLANK_CLIPS_FOLDER}/${fileName}`;

      return await this.multipartUpload(filePath, key, "video/mp4");
    } catch (error) {
      console.error("Error uploading blank clip to S3:", error);
      throw new Error(`Failed to upload blank clip to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async uploadSrtFile(filePath: string, teamId: number, clipId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${clipId}_${Date.now()}.srt`;
      const key = `${SRT_FOLDER}/${fileName}`;

      return await this.multipartUpload(filePath, key, "text/plain");
    } catch (error) {
      console.error("Error uploading SRT file to S3:", error);
      throw new Error(`Failed to upload SRT file to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async downloadFile(key: string, localPath: string): Promise<void> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);
      const writeStream = fs.createWriteStream(localPath);

      if (response.Body) {
        const bodyStream = response.Body as NodeJS.ReadableStream;
        await new Promise<void>((resolve, reject) => {
          bodyStream.pipe(writeStream);
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });
      }
    } catch (error) {
      console.error("Error downloading file from S3:", error);
      throw new Error(`Failed to download file from S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  async deleteObject(key: string): Promise<void> {
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));
  }

  async getMultiplePresignedUrls(keys: string[], expiresIn: number = 3600): Promise<Record<string, string>> {
    const urls: Record<string, string> = {};

    for (const key of keys) {
      if (key) {
        urls[key] = await this.getPresignedUrl(key, expiresIn);
      }
    }

    return urls;
  }
}

export const s3Service = new S3Service();
