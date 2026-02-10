import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { config } from "../config/env";
import { sanitizeFileName } from "../utils/fileUtils";

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

  async uploadWatermarkedClip(filePath: string, teamId: number, clipId: number): Promise<string> {
    try {
      const fileName = `${teamId}/${clipId}_watermarked_${Date.now()}.mp4`;
      const key = `watermarked-clips/${fileName}`;

      return await this.multipartUpload(filePath, key, "video/mp4");
    } catch (error) {
      console.error("Error uploading watermarked clip to S3:", error);
      throw new Error(`Failed to upload watermarked clip to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
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

  async uploadBuffer(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    return key;
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

  async getImageAsBuffer(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new Error("No body in S3 response");
      }

      const chunks: Uint8Array[] = [];
      const stream = response.Body as NodeJS.ReadableStream;

      for await (const chunk of stream) {
        chunks.push(chunk as Uint8Array);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error("Error getting image from S3:", error);
      throw new Error(`Failed to get image from S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getObject(key: string, range?: string) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ...(range ? { Range: range } : {}),
    });

    return await s3Client.send(command);
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  async getPresignedDownloadUrl(key: string, filename: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  async getPresignedUploadUrl(
    teamId: number,
    fileName: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const sanitizedFileName = sanitizeFileName(fileName);
    const s3Key = `${RAW_VIDEOS_FOLDER}/${teamId}/${Date.now()}_${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return { uploadUrl, s3Key };
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      return true;
    } catch {
      return false;
    }
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

  async initiateMultipartUpload(
    teamId: number,
    fileName: string,
    contentType: string
  ): Promise<{ uploadId: string; s3Key: string }> {
    const sanitizedFileName = sanitizeFileName(fileName);
    const s3Key = `${RAW_VIDEOS_FOLDER}/${teamId}/${Date.now()}_${sanitizedFileName}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    });

    const response = await s3Client.send(command);

    if (!response.UploadId) {
      throw new Error("Failed to initiate multipart upload");
    }

    return { uploadId: response.UploadId, s3Key };
  }

  async getPresignedPartUrls(
    s3Key: string,
    uploadId: string,
    partNumbers: number[],
    expiresIn: number = 3600
  ): Promise<{ partNumber: number; uploadUrl: string }[]> {
    const urls = await Promise.all(
      partNumbers.map(async (partNumber) => {
        const command = new UploadPartCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          UploadId: uploadId,
          PartNumber: partNumber,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
        return { partNumber, uploadUrl };
      })
    );

    return urls;
  }

  async completeMultipartUpload(
    s3Key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[]
  ): Promise<void> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
      },
    });

    await s3Client.send(command);
  }

  async abortMultipartUpload(s3Key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      UploadId: uploadId,
    });

    await s3Client.send(command);
  }

  async uploadFile(filePath: string, key: string, contentType: string): Promise<string> {
    try {
      return await this.multipartUpload(filePath, key, contentType);
    } catch (error) {
      console.error("Error uploading file to S3:", error);
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getPresignedUploadUrlForKey(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  async uploadCharacterImage(
    buffer: Buffer,
    teamId: number,
    characterId: string,
    variantIndex: number
  ): Promise<string> {
    const key = `characters/${teamId}/${characterId}/generated/variant_${variantIndex}.png`;
    await this.uploadBuffer(buffer, key, "image/png");
    return key;
  }

  async uploadCharacterReference(
    buffer: Buffer,
    teamId: number,
    characterId: string,
    refIndex: number
  ): Promise<string> {
    const key = `characters/${teamId}/${characterId}/references/ref_${refIndex}.png`;
    await this.uploadBuffer(buffer, key, "image/png");
    return key;
  }

  async getCharacterImagePresignedUpload(
    teamId: number,
    fileName: string
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const sanitizedFileName = sanitizeFileName(fileName);
    const s3Key = `characters/${teamId}/temp/${Date.now()}_${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: "image/png",
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return { uploadUrl, s3Key };
  }

  async getProductImagePresignedUpload(
    teamId: number,
    fileName: string,
    contentType: string = "image/jpeg"
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const sanitizedFileName = sanitizeFileName(fileName);
    const s3Key = `ugc-products/${teamId}/${Date.now()}_${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return { uploadUrl, s3Key };
  }

  async getSceneImagePresignedUpload(
    teamId: number,
    fileName: string,
    contentType: string = "image/jpeg"
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const sanitizedFileName = sanitizeFileName(fileName);
    const s3Key = `scene-images/${teamId}/supporting/${Date.now()}_${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return { uploadUrl, s3Key };
  }

  async uploadTeamLogo(
    buffer: Buffer,
    teamId: number,
    contentType: string = "image/png"
  ): Promise<string> {
    const extension = contentType.split("/")[1] || "png";
    const key = `teams/${teamId}/logo_${Date.now()}.${extension}`;
    await this.uploadBuffer(buffer, key, contentType);
    return key;
  }

  async uploadSceneImage(
    buffer: Buffer,
    teamId: number,
    scriptId: string,
    sceneId: string,
    variantIndex: number
  ): Promise<string> {
    const key = `scene-images/${teamId}/${scriptId}/${sceneId}/variant_${variantIndex}.png`;
    await this.uploadBuffer(buffer, key, "image/png");
    return key;
  }

  async uploadTTSAudio(
    buffer: Buffer,
    teamId: number,
    scriptId: string,
    sceneNumber: number
  ): Promise<string> {
    const key = `ugc-audio/${teamId}/${scriptId}/scene_${sceneNumber}_${Date.now()}.mp3`;
    await this.uploadBuffer(buffer, key, "audio/mpeg");
    console.log(`[S3] Uploaded TTS audio: ${key} (${(buffer.length / 1024).toFixed(1)}KB)`);
    return key;
  }

  async uploadUGCSceneVideo(
    buffer: Buffer,
    teamId: number,
    scriptId: string,
    sceneNumber: number,
    stage: "raw" | "processed"
  ): Promise<string> {
    const key = `ugc-temp-scenes/${teamId}/${scriptId}/${stage}/scene_${sceneNumber}_${Date.now()}.mp4`;
    await this.uploadBuffer(buffer, key, "video/mp4");
    console.log(`[S3] Uploaded UGC ${stage} scene: ${key}`);
    return key;
  }

  async uploadUGCFinalVideo(
    buffer: Buffer,
    teamId: number,
    scriptId: string
  ): Promise<string> {
    const key = `ugc-videos/${teamId}/${scriptId}/final/${scriptId}_${Date.now()}.mp4`;
    await this.uploadBuffer(buffer, key, "video/mp4");
    console.log(`[S3] Uploaded UGC final video: ${key}`);
    return key;
  }

  async uploadUGCFinalVideoFromFile(
    filePath: string,
    teamId: number,
    scriptId: string
  ): Promise<string> {
    const key = `ugc-videos/${teamId}/${scriptId}/final/${scriptId}_${Date.now()}.mp4`;
    await this.uploadFile(filePath, key, "video/mp4");
    console.log(`[S3] Uploaded UGC final video from file: ${key}`);
    return key;
  }

  async downloadToFile(key: string, localPath: string): Promise<void> {
    await this.downloadFile(key, localPath);
  }

  async downloadVideoFromUrl(url: string, localPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    console.log(`[S3] Downloaded video to: ${localPath}`);
  }

  async getFaceDetectUploadUrl(
    teamId: number,
    fileName: string
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const sanitizedFileName = sanitizeFileName(fileName);
    const s3Key = `temp-face-detect/${teamId}/${Date.now()}_${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: "video/mp4",
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return { uploadUrl, s3Key };
  }

  async getUGCUploadUrls(
    teamId: number,
    videoFileName: string,
    imageFileName: string
  ): Promise<{
    video: { uploadUrl: string; s3Key: string };
    image: { uploadUrl: string; s3Key: string };
  }> {
    const sanitizedVideoName = sanitizeFileName(videoFileName);
    const sanitizedImageName = sanitizeFileName(imageFileName);
    const timestamp = Date.now();

    const videoKey = `ugc-inputs/${teamId}/${timestamp}_${sanitizedVideoName}`;
    const imageKey = `ugc-inputs/${teamId}/${timestamp}_${sanitizedImageName}`;

    const videoCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: videoKey,
      ContentType: "video/mp4",
    });

    const imageCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageKey,
      ContentType: "image/jpeg",
    });

    const [videoUrl, imageUrl] = await Promise.all([
      getSignedUrl(s3Client, videoCommand, { expiresIn: 3600 }),
      getSignedUrl(s3Client, imageCommand, { expiresIn: 3600 }),
    ]);

    return {
      video: { uploadUrl: videoUrl, s3Key: videoKey },
      image: { uploadUrl: imageUrl, s3Key: imageKey },
    };
  }

  async getAdCloneUploadUrls(
    teamId: number,
    projectId: string,
    videoFileName: string,
    productImageFileNames: string[]
  ): Promise<{
    video: { uploadUrl: string; s3Key: string };
    productImages: { uploadUrl: string; s3Key: string }[];
  }> {
    const sanitizedVideoName = sanitizeFileName(videoFileName);
    const timestamp = Date.now();

    const videoKey = `ad-clone/${teamId}/${projectId}/reference_${timestamp}_${sanitizedVideoName}`;

    const videoCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: videoKey,
      ContentType: "video/mp4",
    });

    const videoUrl = await getSignedUrl(s3Client, videoCommand, { expiresIn: 3600 });

    const productImagePromises = productImageFileNames.map(async (fileName, index) => {
      const sanitizedName = sanitizeFileName(fileName);
      const imageKey = `ad-clone/${teamId}/${projectId}/product_${timestamp}_${index}_${sanitizedName}`;

      const imageCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: imageKey,
        ContentType: "image/jpeg",
      });

      const uploadUrl = await getSignedUrl(s3Client, imageCommand, { expiresIn: 3600 });
      return { uploadUrl, s3Key: imageKey };
    });

    const productImages = await Promise.all(productImagePromises);

    return {
      video: { uploadUrl: videoUrl, s3Key: videoKey },
      productImages,
    };
  }

  async uploadAdCloneFinalVideo(
    filePath: string,
    teamId: number,
    projectId: string
  ): Promise<string> {
    const key = `ad-clone/${teamId}/${projectId}/final/${projectId}_${Date.now()}.mp4`;
    await this.uploadFile(filePath, key, "video/mp4");
    console.log(`[S3] Uploaded Ad Clone final video: ${key}`);
    return key;
  }
}

export const s3Service = new S3Service();
