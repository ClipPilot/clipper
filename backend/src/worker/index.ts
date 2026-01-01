import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} from "@aws-sdk/client-sqs";
import {
  ECSClient,
  UpdateTaskProtectionCommand,
} from "@aws-sdk/client-ecs";
import { config } from "../config/env";
import { processClipVideoJob } from "./processors/clipProcessor";
import { processBatchClipVideoJob } from "./processors/batchClipProcessor";
import { processCaptionsJob } from "./processors/captionsProcessor";
import { processTextOverlayJob } from "./processors/textOverlayProcessor";
import { processOverlaysJob } from "./processors/overlaysProcessor";
import {
  VideoProcessingJob,
  ClipVideoJob,
  BatchClipVideoJob,
  UpdateCaptionsJob,
  TextOverlayJob,
  UpdateOverlaysJob,
} from "../services/sqs.service";

const sqsClient = new SQSClient({
  region: config.aws.region,
});

const ecsClient = new ECSClient({
  region: config.aws.region,
});

const QUEUE_URL = config.aws.sqsQueueUrl;
const VISIBILITY_TIMEOUT = 900; // 15 minutes
const HEARTBEAT_INTERVAL = 300000; // 5 minutes - extend visibility before it expires
const TASK_PROTECTION_MINUTES = 120; // Protect task for up to 2 hours

let isShuttingDown = false;

// Get ECS task metadata (available in Fargate)
async function getTaskInfo(): Promise<{ cluster: string; taskArn: string } | null> {
  const metadataUri = process.env.ECS_CONTAINER_METADATA_URI_V4;
  if (!metadataUri) {
    console.log("Not running in ECS, skipping task protection");
    return null;
  }

  try {
    const response = await fetch(`${metadataUri}/task`);
    const data = await response.json() as { Cluster: string; TaskARN: string };
    return {
      cluster: data.Cluster,
      taskArn: data.TaskARN,
    };
  } catch (error) {
    console.error("Failed to get ECS task metadata:", error);
    return null;
  }
}

// Enable/disable task protection to prevent scale-in during job processing
async function setTaskProtection(enabled: boolean): Promise<void> {
  const taskInfo = await getTaskInfo();
  if (!taskInfo) return;

  try {
    await ecsClient.send(
      new UpdateTaskProtectionCommand({
        cluster: taskInfo.cluster,
        tasks: [taskInfo.taskArn],
        protectionEnabled: enabled,
        expiresInMinutes: enabled ? TASK_PROTECTION_MINUTES : undefined,
      })
    );
    console.log(`Task protection ${enabled ? "enabled" : "disabled"}`);
  } catch (error) {
    console.error(`Failed to ${enabled ? "enable" : "disable"} task protection:`, error);
  }
}

async function processMessage(job: VideoProcessingJob, receiptHandle: string): Promise<void> {
  console.log(`Processing job type: ${job.type}, teamId: ${job.teamId}`);

  // Enable task protection to prevent scale-in during processing
  await setTaskProtection(true);

  // Set up heartbeat to extend visibility timeout for long-running jobs
  const heartbeat = setInterval(async () => {
    try {
      await sqsClient.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: receiptHandle,
          VisibilityTimeout: VISIBILITY_TIMEOUT,
        })
      );
      console.log(`Extended visibility timeout for job: ${job.type}`);
    } catch (error) {
      console.error("Failed to extend visibility timeout:", error);
    }
  }, HEARTBEAT_INTERVAL);

  try {
    switch (job.type) {
      case "clip-video":
        await processClipVideoJob(job as ClipVideoJob);
        break;
      case "batch-clip-video":
        await processBatchClipVideoJob(job as BatchClipVideoJob);
        break;
      case "update-captions":
        await processCaptionsJob(job as UpdateCaptionsJob);
        break;
      case "text-overlay":
        await processTextOverlayJob(job as TextOverlayJob);
        break;
      case "update-overlays":
        await processOverlaysJob(job as UpdateOverlaysJob);
        break;
      // Note: ugc-face-swap is handled by comfy.worker.ts directly (not SQS)
      // The GPU worker downloads from S3, cuts, uploads to its GPU, processes, stitches
      default:
        console.error(`Unknown job type: ${(job as any).type}`);
    }
  } finally {
    clearInterval(heartbeat);
    // Disable task protection after job completes (or fails)
    await setTaskProtection(false);
  }
}

async function pollMessages(): Promise<void> {
  while (!isShuttingDown) {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1, // Process one message at a time for video processing
        WaitTimeSeconds: 20, // Long polling
        VisibilityTimeout: VISIBILITY_TIMEOUT,
        MessageAttributeNames: ["All"],
      });

      const response = await sqsClient.send(command);

      if (response.Messages && response.Messages.length > 0) {
        for (const message of response.Messages) {
          if (!message.Body || !message.ReceiptHandle) {
            console.error("Invalid message received:", message);
            continue;
          }

          try {
            const job: VideoProcessingJob = JSON.parse(message.Body);
            console.log(`Received job: ${job.type} for team ${job.teamId}`);

            await processMessage(job, message.ReceiptHandle);

            // Delete message after successful processing
            await sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle,
              })
            );
            console.log(`Successfully processed and deleted message for job: ${job.type}`);
          } catch (error) {
            console.error("Error processing message:", error);
            // Message will become visible again after visibility timeout
            // and will be retried (up to maxReceiveCount times before going to DLQ)
          }
        }
      }
    } catch (error) {
      console.error("Error polling SQS:", error);
      // Wait a bit before retrying to avoid hammering SQS on errors
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function main(): Promise<void> {
  console.log("Starting video processing worker...");
  console.log(`Queue URL: ${QUEUE_URL}`);
  console.log(`AWS Region: ${config.aws.region}`);

  if (!QUEUE_URL) {
    console.error("SQS_QUEUE_URL is not configured. Exiting.");
    process.exit(1);
  }

  // Graceful shutdown handlers
  process.on("SIGTERM", () => {
    console.log("Received SIGTERM, shutting down gracefully...");
    isShuttingDown = true;
  });

  process.on("SIGINT", () => {
    console.log("Received SIGINT, shutting down gracefully...");
    isShuttingDown = true;
  });

  await pollMessages();
  console.log("Worker shutdown complete.");
}

main().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
