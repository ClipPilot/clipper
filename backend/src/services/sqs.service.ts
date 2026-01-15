import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { config } from "../config/env";
import { PromptType } from "../constants/promptTypes";

const sqsClient = new SQSClient({
  region: config.aws.region,
});

export type JobType =
  | "clip-video"
  | "batch-clip-video"
  | "update-captions"
  | "text-overlay"
  | "update-overlays"
  | "generate-character"
  | "generate-scene-image"
  | "generate-script"
  | "generate-ugc-video";

// Base job interface
interface BaseJob {
  type: JobType;
  teamId: number;
  clipId?: number;
  clipIds?: number[];
  userId: number;
  createdAt: string;
}

// Clip video job payload
export interface ClipVideoJob extends BaseJob {
  type: "clip-video";
  clipIds: number[];
  s3Key: string; // S3 key where the uploaded video is stored
  options: {
    length?: number;
    hookLength?: number;
    promptType?: PromptType;
    customPrompt?: string;
    textPrompt?: string;
    numberOfVideos?: number;
    customText?: string;
    textPosition?: "top" | "bottom" | "middle";
    textColor?: string;
    textFont?: string;
    captions?: boolean;
    captionColor?: string;
    captionFont?: string;
  };
  originalFileName?: string;
  fileSize?: number;
}

// Batch clip video job payload (multiple source videos)
export interface BatchClipVideoJob extends BaseJob {
  type: "batch-clip-video";
  clipIds: number[];
  videos: Array<{
    s3Key: string;
    videoIndex: number; // 0-4, identifies the source video
    originalFileName?: string;
    fileSize?: number;
    duration?: number; // Duration in seconds
  }>;
  options: ClipVideoJob["options"]; // Reuse same options as single clip
}

// Update captions job payload
export interface UpdateCaptionsJob extends BaseJob {
  type: "update-captions";
  clipId: number;
  captionsData: Array<{
    index: number;
    startTime: number;
    endTime: number;
    text: string;
  }>;
  captionColor?: string;
  captionFont?: string;
  captionsEnabled?: boolean;
}

// Text overlay job payload
export interface TextOverlayJob extends BaseJob {
  type: "text-overlay";
  clipId: number;
  text: string;
  color?: string;
  font?: string;
  x?: number;
  y?: number;
  fontSize?: number;
}

// Combined overlays job payload (heading + captions)
export interface UpdateOverlaysJob extends BaseJob {
  type: "update-overlays";
  clipId: number;
  // Caption options
  captionsEnabled: boolean;
  captionsData?: Array<{
    index: number;
    startTime: number;
    endTime: number;
    text: string;
  }>;
  captionColor?: string;
  captionFont?: string;
  // Heading options
  heading?: {
    text: string;
    color: string;
    font: string;
    x: number;
    y: number;
    fontSize: number;
  };
}

// Character generation job payload
export interface GenerateCharacterJob extends BaseJob {
  type: "generate-character";
  jobId: string;
  config: {
    gender: string;
    ageRange: string;
    appearance: {
      hairColor: string;
      hairStyle: string;
      skinTone: string;
      eyeColor: string;
      bodyType: string;
    };
    style: {
      outfit: string;
      outfitCustom?: string;
      setting: string;
      cameraStyle?: string; // Deprecated - no longer used in UI
      anythingElse?: string;
    };
    referenceImages?: string[];
  };
  parentCharacterId?: number;
}

// Scene image generation job payload
export interface GenerateSceneImageJob extends BaseJob {
  type: "generate-scene-image";
  jobId: string;
  scriptId: string;
  sceneId: string;
  sceneNumber: number;
  characterId: number;
  sceneData: {
    sceneType: string;
    action: string;
    dialogue: string;
    emotion: string;
    shotType: string;
    cameraAngle: string;
    cinematicPrompt: string;
  };
  productImageKeys: string[];
  userRefinement?: string;
  supportingImageKeys: string[];
}

// Script generation job payload
export interface GenerateScriptJob extends BaseJob {
  type: "generate-script";
  jobId: string;
  characterId: number;
  productImageKeys: string[];
  productName?: string;
  scriptDirection?: string;
  targetDuration: number;
  numberOfVariations: number;
  structureId: string;
  customPattern?: { type: string; shot: string }[];
}

export interface GenerateUGCVideoJob extends BaseJob {
  type: "generate-ugc-video";
  jobId: string;
  scriptId: string;
  voiceId: string;
  scenes: Array<{
    sceneId: string;
    sceneNumber: number;
    shotType: "a-roll" | "b-roll" | "mixed";
    imageKey: string;
    endImageKey?: string;
    dialogue: string;
    duration: number;
    cinematicPrompt: string;
    action: string;
    emotion: string;
    ambientSound?: string | null;
    regenerate?: boolean;
  }>;
  regenerateSceneId?: string;
}

export type VideoProcessingJob =
  | ClipVideoJob
  | BatchClipVideoJob
  | UpdateCaptionsJob
  | TextOverlayJob
  | UpdateOverlaysJob
  | GenerateCharacterJob
  | GenerateSceneImageJob
  | GenerateScriptJob
  | GenerateUGCVideoJob;

class SQSService {
  private queueUrl: string;

  constructor() {
    this.queueUrl = config.aws.sqsQueueUrl;
  }

  async sendJob(job: VideoProcessingJob): Promise<string> {
    if (!this.queueUrl) {
      throw new Error("SQS_QUEUE_URL is not configured");
    }

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(job),
      MessageAttributes: {
        JobType: {
          DataType: "String",
          StringValue: job.type,
        },
        TeamId: {
          DataType: "Number",
          StringValue: job.teamId.toString(),
        },
      },
    });

    const response = await sqsClient.send(command);
    console.log(
      `SQS message sent: ${response.MessageId} for job type: ${job.type}`
    );
    return response.MessageId || "";
  }

  async sendClipVideoJob(params: {
    clipIds: number[];
    teamId: number;
    userId: number;
    s3Key: string;
    options: ClipVideoJob["options"];
    originalFileName?: string;
    fileSize?: number;
  }): Promise<string> {
    const job: ClipVideoJob = {
      type: "clip-video",
      clipIds: params.clipIds,
      teamId: params.teamId,
      userId: params.userId,
      s3Key: params.s3Key,
      options: params.options,
      originalFileName: params.originalFileName,
      fileSize: params.fileSize,
      createdAt: new Date().toISOString(),
    };

    return this.sendJob(job);
  }

  async sendBatchClipVideoJob(params: {
    clipIds: number[];
    teamId: number;
    userId: number;
    videos: BatchClipVideoJob["videos"];
    options: BatchClipVideoJob["options"];
  }): Promise<string> {
    const job: BatchClipVideoJob = {
      type: "batch-clip-video",
      clipIds: params.clipIds,
      teamId: params.teamId,
      userId: params.userId,
      videos: params.videos,
      options: params.options,
      createdAt: new Date().toISOString(),
    };

    return this.sendJob(job);
  }

  async sendUpdateCaptionsJob(params: {
    clipId: number;
    teamId: number;
    userId: number;
    captionsData: UpdateCaptionsJob["captionsData"];
    captionColor?: string;
    captionFont?: string;
    captionsEnabled?: boolean;
  }): Promise<string> {
    const job: UpdateCaptionsJob = {
      type: "update-captions",
      clipId: params.clipId,
      teamId: params.teamId,
      userId: params.userId,
      captionsData: params.captionsData,
      captionColor: params.captionColor,
      captionFont: params.captionFont,
      captionsEnabled: params.captionsEnabled,
      createdAt: new Date().toISOString(),
    };

    return this.sendJob(job);
  }

  async sendTextOverlayJob(params: {
    clipId: number;
    teamId: number;
    userId: number;
    text: string;
    color?: string;
    font?: string;
    x?: number;
    y?: number;
    fontSize?: number;
  }): Promise<string> {
    const job: TextOverlayJob = {
      type: "text-overlay",
      clipId: params.clipId,
      teamId: params.teamId,
      userId: params.userId,
      text: params.text,
      color: params.color,
      font: params.font,
      x: params.x,
      y: params.y,
      fontSize: params.fontSize,
      createdAt: new Date().toISOString(),
    };

    return this.sendJob(job);
  }

  async sendUpdateOverlaysJob(params: {
    clipId: number;
    teamId: number;
    userId: number;
    captionsEnabled: boolean;
    captionsData?: UpdateOverlaysJob["captionsData"];
    captionColor?: string;
    captionFont?: string;
    heading?: UpdateOverlaysJob["heading"];
  }): Promise<string> {
    const job: UpdateOverlaysJob = {
      type: "update-overlays",
      clipId: params.clipId,
      teamId: params.teamId,
      userId: params.userId,
      captionsEnabled: params.captionsEnabled,
      captionsData: params.captionsData,
      captionColor: params.captionColor,
      captionFont: params.captionFont,
      heading: params.heading,
      createdAt: new Date().toISOString(),
    };

    return this.sendJob(job);
  }

  async sendGenerateCharacterJob(params: {
    jobId: string;
    teamId: number;
    userId: number;
    config: GenerateCharacterJob["config"];
    parentCharacterId?: number;
  }): Promise<string> {
    const job: GenerateCharacterJob = {
      type: "generate-character",
      jobId: params.jobId,
      teamId: params.teamId,
      userId: params.userId,
      config: params.config,
      parentCharacterId: params.parentCharacterId,
      createdAt: new Date().toISOString(),
    };

    return this.sendJob(job);
  }

  async sendGenerateSceneImageJob(params: {
    jobId: string;
    teamId: number;
    userId: number;
    scriptId: string;
    sceneId: string;
    sceneNumber: number;
    characterId: number;
    sceneData: GenerateSceneImageJob["sceneData"];
    productImageKeys: string[];
    userRefinement?: string;
    supportingImageKeys: string[];
  }): Promise<string> {
    const job: GenerateSceneImageJob = {
      type: "generate-scene-image",
      jobId: params.jobId,
      teamId: params.teamId,
      userId: params.userId,
      scriptId: params.scriptId,
      sceneId: params.sceneId,
      sceneNumber: params.sceneNumber,
      characterId: params.characterId,
      sceneData: params.sceneData,
      productImageKeys: params.productImageKeys,
      userRefinement: params.userRefinement,
      supportingImageKeys: params.supportingImageKeys,
      createdAt: new Date().toISOString(),
    };

    return this.sendJob(job);
  }

  async sendGenerateScriptJob(params: {
    jobId: string;
    teamId: number;
    userId: number;
    characterId: number;
    productImageKeys: string[];
    productName?: string;
    scriptDirection?: string;
    targetDuration: number;
    numberOfVariations: number;
    structureId: string;
    customPattern?: { type: string; shot: string }[];
  }): Promise<string> {
    const job: GenerateScriptJob = {
      type: "generate-script",
      jobId: params.jobId,
      teamId: params.teamId,
      userId: params.userId,
      characterId: params.characterId,
      productImageKeys: params.productImageKeys,
      productName: params.productName,
      scriptDirection: params.scriptDirection,
      targetDuration: params.targetDuration,
      numberOfVariations: params.numberOfVariations,
      structureId: params.structureId,
      customPattern: params.customPattern,
      createdAt: new Date().toISOString(),
    };

    return this.sendJob(job);
  }

  async sendGenerateUGCVideoJob(params: {
    jobId: string;
    teamId: number;
    userId: number;
    scriptId: string;
    voiceId: string;
    scenes: GenerateUGCVideoJob["scenes"];
    regenerateSceneId?: string;
  }): Promise<string> {
    const job: GenerateUGCVideoJob = {
      type: "generate-ugc-video",
      jobId: params.jobId,
      teamId: params.teamId,
      userId: params.userId,
      scriptId: params.scriptId,
      voiceId: params.voiceId,
      scenes: params.scenes,
      regenerateSceneId: params.regenerateSceneId,
      createdAt: new Date().toISOString(),
    };

    return this.sendJob(job);
  }
}

export const sqsService = new SQSService();
