import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { config } from "../config/env";

const s3Client = new S3Client({
  region: config.aws.region,
});

const BUCKET_NAME = config.aws.s3Bucket;
const GENERATED_CLIPS_FOLDER = "generated-clips";
const RAW_VIDEOS_FOLDER = "raw-videos";

class S3Service {
  async uploadRawVideo(filePath: string, teamId: number): Promise<string> {
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
    return key;
  }

  async uploadGeneratedClip(filePath: string, teamId: number, clipId: number): Promise<string> {
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
    return key;
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
