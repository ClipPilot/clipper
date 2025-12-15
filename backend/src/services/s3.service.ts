import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { config } from "../config/env";

// AWS SDK v3 automatically uses credentials from the default credential provider chain
// (AWS CLI config, ~/.aws/credentials, environment variables, IAM roles, etc.)
const s3Client = new S3Client({
  region: config.aws.region,
});

const BUCKET_NAME = config.aws.s3Bucket;
const GENERATED_CLIPS_FOLDER = "generated-clips";
const BLANK_CLIPS_FOLDER = "blank-clips";
const SRT_FOLDER = "srt-files";
const THUMBNAILS_FOLDER = "thumbnails";
const RAW_VIDEOS_FOLDER = "raw-videos";

class S3Service {
  async uploadRawVideo(filePath: string, teamId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${Date.now()}_${path.basename(filePath)}`;
      const key = `${RAW_VIDEOS_FOLDER}/${fileName}`;

      const fileStream = fs.createReadStream(filePath);
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: "video/mp4",
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      console.log(`Raw video uploaded to S3 successfully: ${key}`);
      return key;
    } catch (error) {
      console.error("Error uploading raw video to S3:", error);
      throw new Error(`Failed to upload raw video to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async uploadThumbnail(filePath: string, teamId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${Date.now()}_${path.basename(filePath)}`;
      const key = `${THUMBNAILS_FOLDER}/${fileName}`;

      const fileStream = fs.createReadStream(filePath);
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: "image/jpeg",
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      console.log(`Thumbnail uploaded to S3 successfully: ${key}`);
      return key;
    } catch (error) {
      console.error("Error uploading thumbnail to S3:", error);
      throw new Error(`Failed to upload thumbnail to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async uploadGeneratedClip(filePath: string, teamId: number, clipId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${clipId}_${Date.now()}.mp4`;
      const key = `${GENERATED_CLIPS_FOLDER}/${fileName}`;

      const fileStream = fs.createReadStream(filePath);
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: "video/mp4",
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      console.log(`Generated clip uploaded to S3 successfully: ${key}`);
      return key;
    } catch (error) {
      console.error("Error uploading generated clip to S3:", error);
      throw new Error(`Failed to upload generated clip to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async uploadBlankClip(filePath: string, teamId: number, clipId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${clipId}_${Date.now()}.mp4`;
      const key = `${BLANK_CLIPS_FOLDER}/${fileName}`;

      const fileStream = fs.createReadStream(filePath);
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: "video/mp4",
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      console.log(`Blank clip uploaded to S3 successfully: ${key}`);
      return key;
    } catch (error) {
      console.error("Error uploading blank clip to S3:", error);
      throw new Error(`Failed to upload blank clip to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async uploadSrtFile(filePath: string, teamId: number, clipId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${clipId}_${Date.now()}.srt`;
      const key = `${SRT_FOLDER}/${fileName}`;

      const fileStream = fs.createReadStream(filePath);
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: "text/plain",
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      console.log(`SRT file uploaded to S3 successfully: ${key}`);
      return key;
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
