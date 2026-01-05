import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { config } from "../config/env";

// Swap type determines which workflow to use
export type SwapType = "face" | "fullBody";

export interface GpuJobMessage {
  type: "ugc-face-swap";
  jobId: string;
  teamId: number;
  userId: number;
  imageS3Key: string;
  chunkS3Keys: string[];
  originalVideoS3Key?: string;
  segments: Array<{ start: number; end: number }>;
  videoDuration: number;
  spliceMode: boolean;
  spliceMetadata?: {
    videoDuration: number;
    segments: Array<{ start: number; end: number; type: string }>;
  };
  swapType: SwapType;
  createdAt: string;
}

const sqsClient = new SQSClient({
  region: config.aws.region,
});

class GpuSqsService {
  private queueUrl: string;

  constructor() {
    this.queueUrl = config.aws.gpuSqsQueueUrl;
  }

  /**
   * Send a face swap job to the GPU processing queue
   */
  async sendFaceSwapJob(
    job: Omit<GpuJobMessage, "type" | "createdAt">
  ): Promise<string> {
    if (!this.queueUrl) {
      throw new Error("GPU_SQS_QUEUE_URL is not configured");
    }

    const message: GpuJobMessage = {
      ...job,
      type: "ugc-face-swap",
      createdAt: new Date().toISOString(),
    };

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        JobType: {
          DataType: "String",
          StringValue: "ugc-face-swap",
        },
        TeamId: {
          DataType: "Number",
          StringValue: job.teamId.toString(),
        },
      },
    });

    const response = await sqsClient.send(command);
    console.log(
      `[gpu-sqs] Message sent: ${response.MessageId} for team ${job.teamId}`
    );
    return response.MessageId || "";
  }
}

export const gpuSqsService = new GpuSqsService();
