import "../instrument";
import * as Sentry from "@sentry/node";
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

process.on("uncaughtException", (error) => {
  console.error("[worker] UNCAUGHT EXCEPTION:", error);
  Sentry.captureException(error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[worker] UNHANDLED REJECTION:", reason);
  Sentry.captureException(reason);
});
import { processClipVideoJob } from "./processors/clipProcessor";
import { processBatchClipVideoJob } from "./processors/batchClipProcessor";
import { processCaptionsJob } from "./processors/captionsProcessor";
import { processTextOverlayJob } from "./processors/textOverlayProcessor";
import { processOverlaysJob } from "./processors/overlaysProcessor";
import { processCharacterJob } from "./processors/characterProcessor";
import { processSceneImageJob } from "./processors/sceneImageProcessor";
import { processScriptJob } from "./processors/scriptProcessor";
import { processUGCVideoJob } from "./processors/ugcVideoProcessor";
import { processKlingFaceSwapJob } from "./processors/klingFaceSwapProcessor";
import {
  VideoProcessingJob,
  ClipVideoJob,
  BatchClipVideoJob,
  UpdateCaptionsJob,
  TextOverlayJob,
  UpdateOverlaysJob,
  GenerateCharacterJob,
  GenerateSceneImageJob,
  GenerateScriptJob,
  GenerateUGCVideoJob,
  KlingFaceSwapJob,
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
const TASK_PROTECTION_MINUTES = 60; // Protect task for up to 60 minutes (safety net)
const MAX_CONCURRENT_JOBS = 5; // Process up to 5 jobs concurrently

let isShuttingDown = false;
let activeJobs = 0;

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
      case "generate-character":
        await processCharacterJob(job as GenerateCharacterJob);
        break;
      case "generate-scene-image":
        await processSceneImageJob(job as GenerateSceneImageJob);
        break;
      case "generate-script":
        await processScriptJob(job as GenerateScriptJob);
        break;
      case "generate-ugc-video":
        await processUGCVideoJob(job as GenerateUGCVideoJob);
        break;
      case "kling-face-swap":
        await processKlingFaceSwapJob(job as KlingFaceSwapJob);
        break;
      default:
        console.error(`Unknown job type: ${(job as any).type}`);
    }
  } finally {
    clearInterval(heartbeat);
    // Only disable task protection when ALL jobs are complete
    if (activeJobs <= 1) {
      await setTaskProtection(false);
    }
  }
}

async function handleMessage(message: { Body: string; ReceiptHandle: string }): Promise<void> {
  activeJobs++;
  try {
    const job: VideoProcessingJob = JSON.parse(message.Body);
    console.log(`[Worker] Starting job: ${job.type} for team ${job.teamId} (active: ${activeJobs})`);

    await processMessage(job, message.ReceiptHandle);

    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      })
    );
    console.log(`[Worker] Completed job: ${job.type} (active: ${activeJobs - 1})`);
  } catch (error) {
    console.error("[Worker] Error processing message:", error);
  } finally {
    activeJobs--;
  }
}

async function pollMessages(): Promise<void> {
  while (!isShuttingDown) {
    try {
      // Only fetch more messages if we have capacity
      const availableSlots = MAX_CONCURRENT_JOBS - activeJobs;
      if (availableSlots <= 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: Math.min(availableSlots, 10),
        WaitTimeSeconds: activeJobs > 0 ? 5 : 20, // Shorter poll when already processing
        VisibilityTimeout: VISIBILITY_TIMEOUT,
        MessageAttributeNames: ["All"],
      });

      const response = await sqsClient.send(command);

      if (response.Messages && response.Messages.length > 0) {
        console.log(`[Worker] Received ${response.Messages.length} messages (active: ${activeJobs})`);

        for (const message of response.Messages) {
          if (!message.Body || !message.ReceiptHandle) {
            console.error("Invalid message received:", message);
            continue;
          }

          // Fire and forget - don't await, let them run concurrently
          handleMessage({ Body: message.Body, ReceiptHandle: message.ReceiptHandle });
        }
      }
    } catch (error) {
      console.error("Error polling SQS:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Wait for active jobs to complete before shutting down
  while (activeJobs > 0) {
    console.log(`[Worker] Waiting for ${activeJobs} active jobs to complete...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
