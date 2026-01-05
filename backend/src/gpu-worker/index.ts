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
import { processGpuJob } from "./processor";
import { GpuJobMessage } from "../services/gpuSqs.service";

const sqsClient = new SQSClient({
  region: config.aws.region,
});

const ecsClient = new ECSClient({
  region: config.aws.region,
});

const QUEUE_URL = config.aws.gpuSqsQueueUrl;
const VISIBILITY_TIMEOUT = 1800; // 30 minutes - GPU jobs are long
const HEARTBEAT_INTERVAL = 300000; // 5 minutes - extend visibility before it expires
const TASK_PROTECTION_MINUTES = 120; // Protect task for up to 2 hours

let isShuttingDown = false;

// Get ECS task metadata (available in Fargate)
async function getTaskInfo(): Promise<{ cluster: string; taskArn: string } | null> {
  const metadataUri = process.env.ECS_CONTAINER_METADATA_URI_V4;
  if (!metadataUri) {
    console.log("[gpu-worker] Not running in ECS, skipping task protection");
    return null;
  }

  try {
    const response = await fetch(`${metadataUri}/task`);
    const data = (await response.json()) as { Cluster: string; TaskARN: string };
    return {
      cluster: data.Cluster,
      taskArn: data.TaskARN,
    };
  } catch (error) {
    console.error("[gpu-worker] Failed to get ECS task metadata:", error);
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
    console.log(`[gpu-worker] Task protection ${enabled ? "enabled" : "disabled"}`);
  } catch (error) {
    console.error(
      `[gpu-worker] Failed to ${enabled ? "enable" : "disable"} task protection:`,
      error
    );
  }
}

async function processMessage(
  job: GpuJobMessage,
  receiptHandle: string
): Promise<void> {
  console.log(`[gpu-worker] Processing job type: ${job.type}, teamId: ${job.teamId}`);

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
      console.log(`[gpu-worker] Extended visibility timeout for job`);
    } catch (error) {
      console.error("[gpu-worker] Failed to extend visibility timeout:", error);
    }
  }, HEARTBEAT_INTERVAL);

  try {
    await processGpuJob(job);
  } finally {
    clearInterval(heartbeat);
    // Disable task protection after job completes (or fails)
    await setTaskProtection(false);
  }
}

async function pollMessages(): Promise<void> {
  console.log("[gpu-worker] Starting SQS polling loop...");

  while (!isShuttingDown) {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1, // Process one message at a time
        WaitTimeSeconds: 20, // Long polling
        VisibilityTimeout: VISIBILITY_TIMEOUT,
        MessageAttributeNames: ["All"],
      });

      const response = await sqsClient.send(command);

      if (response.Messages && response.Messages.length > 0) {
        for (const message of response.Messages) {
          if (!message.Body || !message.ReceiptHandle) {
            console.error("[gpu-worker] Invalid message received:", message);
            continue;
          }

          try {
            const job: GpuJobMessage = JSON.parse(message.Body);
            console.log(
              `[gpu-worker] Received job: ${job.type} for team ${job.teamId}`
            );

            await processMessage(job, message.ReceiptHandle);
            console.log(`[gpu-worker] Successfully processed job`);
          } catch (error) {
            console.error("[gpu-worker] Error processing message:", error);
          } finally {
            // Always delete message - no retry on failure
            // Failed jobs are marked in DB and credits refunded by processor
            try {
              await sqsClient.send(
                new DeleteMessageCommand({
                  QueueUrl: QUEUE_URL,
                  ReceiptHandle: message.ReceiptHandle,
                })
              );
              console.log(`[gpu-worker] Deleted message from queue`);
            } catch (deleteError) {
              console.error("[gpu-worker] Failed to delete message:", deleteError);
            }
          }
        }
      }
    } catch (error) {
      console.error("[gpu-worker] Error polling SQS:", error);
      // Wait a bit before retrying to avoid hammering SQS on errors
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function main(): Promise<void> {
  console.log("[gpu-worker] Starting GPU processing worker...");
  console.log(`[gpu-worker] Queue URL: ${QUEUE_URL}`);
  console.log(`[gpu-worker] AWS Region: ${config.aws.region}`);

  if (!QUEUE_URL) {
    console.error("[gpu-worker] GPU_SQS_QUEUE_URL is not configured. Exiting.");
    process.exit(1);
  }

  // Graceful shutdown handlers
  process.on("SIGTERM", () => {
    console.log("[gpu-worker] Received SIGTERM, shutting down gracefully...");
    isShuttingDown = true;
  });

  process.on("SIGINT", () => {
    console.log("[gpu-worker] Received SIGINT, shutting down gracefully...");
    isShuttingDown = true;
  });

  await pollMessages();
  console.log("[gpu-worker] Worker shutdown complete.");
}

main().catch((error) => {
  console.error("[gpu-worker] Worker failed to start:", error);
  process.exit(1);
});
