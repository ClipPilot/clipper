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
import path from "path";
import fs from "fs";

process.on("uncaughtException", (error) => {
  console.error("[gpu-worker] UNCAUGHT EXCEPTION:", error);
  Sentry.captureException(error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[gpu-worker] UNHANDLED REJECTION:", reason);
  Sentry.captureException(reason);
});

import { processGpuJob } from "./processor";
import { GpuJobMessage } from "../services/gpuSqs.service";

const sqsClient = new SQSClient({
  region: config.aws.region,
});

const ecsClient = new ECSClient({
  region: config.aws.region,
});

const QUEUE_URL = config.aws.gpuSqsQueueUrl;
const VISIBILITY_TIMEOUT = 1800;
const HEARTBEAT_INTERVAL = 300000;
const TASK_PROTECTION_MINUTES = 120;

let isShuttingDown = false;
let activeJobCount = 0;

interface GpuConfig {
  id: string;
  name: string;
  url: string;
  podId?: string;
}

function loadGpuConfig(): GpuConfig[] {
  try {
    const configDir = path.join(__dirname, "../config/comfy");
    const gpuConfig = JSON.parse(
      fs.readFileSync(path.join(configDir, "gpus.config.json"), "utf-8")
    );
    return gpuConfig.gpus || [];
  } catch (error) {
    console.error("[gpu-worker] Failed to load GPU config:", error);
    return [];
  }
}

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
  receiptHandle: string,
  gpuId: string
): Promise<void> {
  console.log(`[gpu-worker:${gpuId}] Processing job type: ${job.type}, teamId: ${job.teamId}`);

  activeJobCount++;

  if (activeJobCount === 1) {
    await setTaskProtection(true);
  }

  const heartbeat = setInterval(async () => {
    try {
      await sqsClient.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: receiptHandle,
          VisibilityTimeout: VISIBILITY_TIMEOUT,
        })
      );
      console.log(`[gpu-worker:${gpuId}] Extended visibility timeout for job`);
    } catch (error) {
      console.error(`[gpu-worker:${gpuId}] Failed to extend visibility timeout:`, error);
    }
  }, HEARTBEAT_INTERVAL);

  try {
    process.env.GPU_ID = gpuId;
    await processGpuJob(job);
  } finally {
    clearInterval(heartbeat);
    activeJobCount--;

    if (activeJobCount === 0) {
      await setTaskProtection(false);
    }
  }
}

const busyGpus = new Set<string>();

async function pollMessagesForGpu(gpuId: string): Promise<void> {
  console.log(`[gpu-worker:${gpuId}] Starting polling loop for GPU ${gpuId}...`);

  while (!isShuttingDown) {
    if (busyGpus.has(gpuId)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: VISIBILITY_TIMEOUT,
        MessageAttributeNames: ["All"],
      });

      const response = await sqsClient.send(command);

      if (response.Messages && response.Messages.length > 0) {
        const message = response.Messages[0];

        if (!message.Body || !message.ReceiptHandle) {
          console.error(`[gpu-worker:${gpuId}] Invalid message received:`, message);
          continue;
        }

        busyGpus.add(gpuId);

        try {
          const job: GpuJobMessage = JSON.parse(message.Body);
          console.log(
            `[gpu-worker:${gpuId}] Received job: ${job.type} for team ${job.teamId}`
          );

          await processMessage(job, message.ReceiptHandle, gpuId);
          console.log(`[gpu-worker:${gpuId}] Successfully processed job`);
        } catch (error) {
          console.error(`[gpu-worker:${gpuId}] Error processing message:`, error);
        } finally {
          busyGpus.delete(gpuId);

          try {
            await sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle,
              })
            );
            console.log(`[gpu-worker:${gpuId}] Deleted message from queue`);
          } catch (deleteError) {
            console.error(`[gpu-worker:${gpuId}] Failed to delete message:`, deleteError);
          }
        }
      }
    } catch (error) {
      console.error(`[gpu-worker:${gpuId}] Error polling SQS:`, error);
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

  process.on("SIGTERM", () => {
    console.log("[gpu-worker] Received SIGTERM, shutting down gracefully...");
    isShuttingDown = true;
  });

  process.on("SIGINT", () => {
    console.log("[gpu-worker] Received SIGINT, shutting down gracefully...");
    isShuttingDown = true;
  });

  const assignedGpuId = process.env.GPU_ID;

  if (assignedGpuId) {
    console.log(`[gpu-worker] Running in single-GPU mode with GPU: ${assignedGpuId}`);
    await pollMessagesForGpu(assignedGpuId);
  } else {
    const gpus = loadGpuConfig();

    if (gpus.length === 0) {
      console.error("[gpu-worker] No GPUs configured. Exiting.");
      process.exit(1);
    }

    console.log(`[gpu-worker] Running in multi-GPU mode with ${gpus.length} GPUs: ${gpus.map(g => g.id).join(", ")}`);

    const pollingPromises = gpus.map((gpu) => pollMessagesForGpu(gpu.id));
    await Promise.all(pollingPromises);
  }

  console.log("[gpu-worker] Worker shutdown complete.");
}

main().catch((error) => {
  console.error("[gpu-worker] Worker failed to start:", error);
  process.exit(1);
});
