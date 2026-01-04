import WebSocket from "ws";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "../db";
import { comfyJobs, teamMembers, clips, users } from "@clipper/shared-db/src/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { config } from "../config/env";
import { s3Service } from "./s3.service";
import { cutClip, mergeClips, extractLastFrame, extractFirstFrame, getVideoDuration } from "./videoEditor.service";
import { emitComfyJobUpdate } from "./socket.service";
import { teamService } from "./team.service";
import { emailNotiService } from "./emailNoti.service";
import { transcribeVideoService } from "./transcription.service";
import { convertWordsToCaptionEntries, generateSrtFromCaptions } from "./captions.service";
import { acquireJobLock, releaseJobLock, extendJobLock } from "./redis.service";

interface GpuConfig {
  id: string;
  name: string;
  url: string;
  cleanupUrl?: string;
}

interface GpuConfigFile {
  gpus: GpuConfig[];
}

interface ComfyJob {
  id: string;
  teamId: number;
  imageFile: string;
  videoFile: string;
  status: string;
  parentJobId?: string;
  sequenceNumber?: number;
  jobType: string;
  originalVideoS3Key?: string;
  totalChunks?: number;
  spliceMode?: boolean;
  spliceMetadata?: {
    videoDuration: number;
    segments: Array<{ start: number; end: number; type: string }>;
  };
}

interface ComfyOutput {
  filename: string;
  type?: string;
  subfolder?: string;
}

interface WorkflowOutputs {
  [nodeId: string]: {
    gifs?: ComfyOutput[];
    videos?: ComfyOutput[];
    images?: ComfyOutput[];
  };
}

// Load configs
const configDir = path.join(__dirname, "../config/comfy");
const gpuConfig: GpuConfigFile = JSON.parse(
  fs.readFileSync(path.join(configDir, "gpus.config.json"), "utf-8")
);
const workflowTemplate = JSON.parse(
  fs.readFileSync(path.join(configDir, "workflow.json"), "utf-8")
);

const s3 = new S3Client({ region: config.aws.region });

let isRunning = false;

// ─────────────────────────────────────────────────────────────
// GPU Management
// ─────────────────────────────────────────────────────────────

async function checkGpuAvailability(
  gpu: GpuConfig
): Promise<{ available: boolean; queueRemaining?: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${gpu.url}/prompt`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return { available: false };

    const data = (await res.json()) as {
      exec_info?: { queue_remaining?: number };
    };
    const queueRemaining = data.exec_info?.queue_remaining ?? 1;

    return { available: queueRemaining === 0, queueRemaining };
  } catch (err) {
    console.error(
      `[comfy-worker] GPU ${gpu.id} check failed:`,
      (err as Error).message
    );
    return { available: false };
  }
}

const UPLOAD_TIMEOUT_MS = 60000;
const UPLOAD_MAX_RETRIES = 3;

async function uploadFileToGpu(
  gpu: GpuConfig,
  filePath: string,
  retryCount = 0
): Promise<string> {
  const ext = path.extname(filePath);
  const filename = `${crypto.randomUUID()}${ext}`;

  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer]);

  const form = new FormData();
  form.append("image", blob, filename);
  form.append("type", "input");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(`${gpu.url}/upload/image`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const responseBody = await res.text();
      console.error(
        `[comfy-worker] GPU upload failed for ${gpu.id}:`,
        `\n  Status: ${res.status} ${res.statusText}`,
        `\n  Response: ${responseBody.slice(0, 200)}`
      );
      throw new Error(`GPU upload failed (${res.status})`);
    }

    const data = (await res.json()) as { name: string };
    console.log(
      `[comfy-worker] Uploaded ${path.basename(filePath)} to GPU ${gpu.id} as ${data.name}`
    );
    return data.name;
  } catch (err) {
    clearTimeout(timeoutId);

    const isTimeout = err instanceof Error && err.name === "AbortError";
    const errMsg = isTimeout ? "timeout" : (err instanceof Error ? err.message : String(err));

    if (retryCount < UPLOAD_MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`[comfy-worker] Upload to ${gpu.id} failed (${errMsg}), retry ${retryCount + 1}/${UPLOAD_MAX_RETRIES} in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      return uploadFileToGpu(gpu, filePath, retryCount + 1);
    }

    throw new Error(`GPU upload failed after ${UPLOAD_MAX_RETRIES} retries: ${errMsg}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Database Operations
// ─────────────────────────────────────────────────────────────

async function getNextJob(): Promise<ComfyJob | null> {
  try {
    // Fetch multiple candidates to handle race conditions
    const jobs = await db
      .select({
        id: comfyJobs.id,
        teamId: comfyJobs.teamId,
        imageFile: comfyJobs.imageFile,
        videoFile: comfyJobs.videoFile,
        status: comfyJobs.status,
        parentJobId: comfyJobs.parentJobId,
        sequenceNumber: comfyJobs.sequenceNumber,
        jobType: comfyJobs.jobType,
        originalVideoS3Key: comfyJobs.originalVideoS3Key,
        totalChunks: comfyJobs.totalChunks,
        spliceMode: comfyJobs.spliceMode,
        spliceMetadata: comfyJobs.spliceMetadata,
      })
      .from(comfyJobs)
      .where(
        and(
          eq(comfyJobs.status, "queued"),
          inArray(comfyJobs.jobType, [
            "single",
            "ugc-face-swap-chunk",
            "ugc-face-swap-parent",
          ])
        )
      )
      .orderBy(desc(comfyJobs.priority), asc(comfyJobs.createdAt))
      .limit(5);

    if (jobs.length === 0) return null;

    // Try to acquire lock on each job (Redis distributed lock)
    for (const job of jobs) {
      const lockAcquired = await acquireJobLock(job.id);
      if (!lockAcquired) {
        console.log(`[comfy-worker] Job ${job.id} locked by another instance, skipping`);
        continue;
      }

      // Double-check status (another instance may have claimed it)
      const [current] = await db
        .select({ status: comfyJobs.status })
        .from(comfyJobs)
        .where(eq(comfyJobs.id, job.id))
        .limit(1);

      if (current?.status !== "queued") {
        console.log(`[comfy-worker] Job ${job.id} no longer queued, skipping`);
        continue;
      }

      // Mark as running
      await db
        .update(comfyJobs)
        .set({
          status: "running",
          startedAt: new Date(),
        })
        .where(eq(comfyJobs.id, job.id));

      return {
        id: job.id,
        teamId: job.teamId,
        imageFile: job.imageFile,
        videoFile: job.videoFile,
        status: job.status,
        parentJobId: job.parentJobId ?? undefined,
        sequenceNumber: job.sequenceNumber ?? undefined,
        jobType: job.jobType,
        originalVideoS3Key: job.originalVideoS3Key ?? undefined,
        totalChunks: job.totalChunks ?? undefined,
        spliceMode: job.spliceMode ?? undefined,
        spliceMetadata: job.spliceMetadata as ComfyJob["spliceMetadata"],
      };
    }

    return null;
  } catch (err) {
    console.error("[comfy-worker] getNextJob error:", err);
    return null;
  }
}

async function updateProgress(
  jobId: string,
  teamId: number,
  progress: number,
  message?: string
): Promise<void> {
  await db
    .update(comfyJobs)
    .set({
      progress,
      progressMessage: message || null,
    })
    .where(eq(comfyJobs.id, jobId));

  emitComfyJobUpdate(teamId, {
    id: jobId,
    status: "running",
    progress,
    progressMessage: message || null,
    outputUrl: null,
    errorMessage: null,
    finishedAt: null,
  });
}

async function completeJob(
  jobId: string,
  teamId: number,
  success: boolean,
  outputFile?: string,
  outputUrl?: string,
  errorMessage?: string
): Promise<void> {
  const finishedAt = new Date();
  await db
    .update(comfyJobs)
    .set({
      status: success ? "completed" : "failed",
      progress: success ? 100 : null,
      progressMessage: success ? "Completed" : errorMessage || null,
      outputFile: outputFile || null,
      errorMessage: errorMessage || null,
      finishedAt,
    })
    .where(eq(comfyJobs.id, jobId));

  emitComfyJobUpdate(teamId, {
    id: jobId,
    status: success ? "completed" : "failed",
    progress: success ? 100 : null,
    progressMessage: success ? "Completed" : errorMessage || null,
    outputUrl: outputUrl || null,
    errorMessage: errorMessage || null,
    finishedAt: finishedAt.toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────
// ComfyUI Workflow
// ─────────────────────────────────────────────────────────────

function buildWorkflow(
  imageFile: string,
  videoFile: string
): Record<string, unknown> {
  const workflow = JSON.parse(JSON.stringify(workflowTemplate));

  // Inject reference image (node 311 - LoadImage)
  if (workflow["311"]?.inputs) {
    workflow["311"].inputs.image = imageFile;
  }

  // Inject reference video (node 417 - VHS_LoadVideo)
  if (workflow["417"]?.inputs) {
    workflow["417"].inputs.video = videoFile;
  }

  return workflow;
}

async function submitPrompt(
  gpu: GpuConfig,
  workflow: Record<string, unknown>,
  clientId: string
): Promise<string> {
  const res = await fetch(`${gpu.url}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      prompt: workflow,
    }),
  });

  const data = (await res.json()) as {
    prompt_id?: string;
    error?: string;
    node_errors?: Record<string, unknown>;
  };

  if (data.error) {
    const nodeErrors = data.node_errors
      ? Object.entries(data.node_errors)
          .map(([node, err]) => `Node ${node}: ${JSON.stringify(err)}`)
          .join("; ")
      : "";
    throw new Error(`ComfyUI error: ${data.error}. ${nodeErrors}`);
  }

  return data.prompt_id!;
}

// ─────────────────────────────────────────────────────────────
// WebSocket Progress Tracking
// ─────────────────────────────────────────────────────────────

function waitForCompletion(
  gpu: GpuConfig,
  promptId: string,
  clientId: string,
  jobId: string
): Promise<WorkflowOutputs> {
  return new Promise((resolve, reject) => {
    const wsUrl = gpu.url.replace(/^http/, "ws") + `/ws?clientId=${clientId}`;
    console.log(`[comfy-worker] Connecting to WebSocket`);

    const ws = new WebSocket(wsUrl);
    let timeout: NodeJS.Timeout | null = null;
    let settled = false;
    let lastMessageTime = Date.now();

    const safeResolve = (value: WorkflowOutputs) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(value);
    };

    const safeReject = (err: Error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      reject(err);
    };

    const resetTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(
        () => {
          ws.close();
          safeReject(new Error("Workflow execution timed out after 60 minutes"));
        },
        60 * 60 * 1000
      );
    };

    resetTimeout();

    ws.on("open", () => {
      console.log("[comfy-worker] WebSocket connected");
      lastMessageTime = Date.now();
    });

    ws.on("message", async (rawData) => {
      resetTimeout();
      lastMessageTime = Date.now();

      if (Buffer.isBuffer(rawData) && rawData[0] !== 0x7b) {
        return;
      }

      try {
        const msgStr = rawData.toString();
        const msg = JSON.parse(msgStr) as {
          type: string;
          data: {
            prompt_id?: string;
            value?: number;
            max?: number;
            node?: string;
            exception_message?: string;
            message?: string;
          };
        };

        console.log(
          `[comfy-worker] WS message: ${msg.type}`,
          msg.data?.prompt_id === promptId ? "(our job)" : ""
        );

        if (msg.type === "execution_start" && msg.data.prompt_id === promptId) {
          console.log("[comfy-worker] Execution started");
        }

        if (msg.type === "executing" && msg.data.prompt_id === promptId) {
          const node = msg.data.node;
          if (node) {
            const nodeMeta =
              (workflowTemplate[node] as { _meta?: { title?: string } })?._meta
                ?.title || node;
            console.log(`[comfy-worker] Executing: ${nodeMeta}`);
          } else {
            console.log("[comfy-worker] Workflow finished (node=null)");
            ws.close();

            try {
              const histRes = await fetch(`${gpu.url}/history/${promptId}`);
              const hist = (await histRes.json()) as Record<string, unknown>;
              const promptData = hist[promptId] as
                | { outputs?: WorkflowOutputs }
                | undefined;
              const outputs = promptData?.outputs;

              if (outputs) {
                console.log("[comfy-worker] Got outputs from nodes:", Object.keys(outputs));
                safeResolve(outputs);
              } else {
                safeReject(new Error("No outputs found in history"));
              }
            } catch (fetchErr) {
              safeReject(new Error(`Failed to fetch history: ${(fetchErr as Error).message}`));
            }
            return;
          }
        }

        if (msg.type === "execution_complete" && msg.data.prompt_id === promptId) {
          console.log("[comfy-worker] Execution complete");
          ws.close();

          try {
            const histRes = await fetch(`${gpu.url}/history/${promptId}`);
            const hist = (await histRes.json()) as Record<string, unknown>;
            const promptData = hist[promptId] as
              | { outputs?: WorkflowOutputs }
              | undefined;
            const outputs = promptData?.outputs;

            console.log("[comfy-worker] Outputs keys:", outputs ? Object.keys(outputs) : "none");
            if (outputs) {
              for (const [nodeId, nodeOut] of Object.entries(outputs)) {
                console.log(`[comfy-worker] Node ${nodeId} output keys:`, Object.keys(nodeOut));
              }
              safeResolve(outputs);
            } else {
              safeReject(new Error("No outputs found in history"));
            }
          } catch (fetchErr) {
            safeReject(new Error(`Failed to fetch history: ${(fetchErr as Error).message}`));
          }
        }

        if (msg.type === "execution_error" && msg.data.prompt_id === promptId) {
          ws.close();
          const errMsg = msg.data.exception_message || msg.data.message || "Unknown error";
          safeReject(new Error(`Execution error: ${errMsg}`));
        }
      } catch (err) {
        console.error("[comfy-worker] Error parsing message:", (err as Error).message);
      }
    });

    ws.on("error", (err) => {
      console.error("[comfy-worker] WebSocket error:", err.message);
      safeReject(err);
    });

    ws.on("close", () => {
      console.log("[comfy-worker] WebSocket closed");
      const silentDuration = Date.now() - lastMessageTime;
      if (!settled) {
        safeReject(new Error(`WebSocket closed unexpectedly (last message ${Math.round(silentDuration / 1000)}s ago)`));
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Output Handling
// ─────────────────────────────────────────────────────────────

function findVideoOutput(outputs: WorkflowOutputs): ComfyOutput | null {
  console.log(
    "[comfy-worker] Looking for video output in nodes:",
    Object.keys(outputs)
  );

  // Check node 467 first (RIFE interpolated - higher quality)
  const node467 = outputs["467"] as Record<string, ComfyOutput[]> | undefined;
  if (node467) {
    console.log("[comfy-worker] Node 467 has keys:", Object.keys(node467));
    // VHS_VideoCombine can output to 'gifs', 'videos', or 'images'
    const video =
      node467.gifs?.[0] || node467.videos?.[0] || node467.images?.[0];
    if (video) {
      console.log("[comfy-worker] Found output in node 467:", video);
      return video;
    }
  }

  // Check node 462 (base output)
  const node462 = outputs["462"] as Record<string, ComfyOutput[]> | undefined;
  if (node462) {
    console.log("[comfy-worker] Node 462 has keys:", Object.keys(node462));
    const video =
      node462.gifs?.[0] || node462.videos?.[0] || node462.images?.[0];
    if (video) {
      console.log("[comfy-worker] Found output in node 462:", video);
      return video;
    }
  }

  // Fallback: search all nodes for any video-like output
  for (const [nodeId, nodeOutput] of Object.entries(outputs)) {
    const output = nodeOutput as Record<string, ComfyOutput[]>;
    console.log(
      `[comfy-worker] Checking node ${nodeId}, keys:`,
      Object.keys(output)
    );

    const video = output.gifs?.[0] || output.videos?.[0] || output.images?.[0];
    if (video && video.filename?.includes(".mp4")) {
      console.log(`[comfy-worker] Found mp4 in node ${nodeId}:`, video);
      return video;
    }
  }

  console.log("[comfy-worker] No video output found!");
  return null;
}

async function downloadOutput(
  gpu: GpuConfig,
  file: ComfyOutput
): Promise<Buffer> {
  const url = new URL(`${gpu.url}/view`);
  url.searchParams.set("filename", file.filename);
  url.searchParams.set("type", file.type || "output");
  url.searchParams.set("subfolder", file.subfolder || "");

  console.log(`[comfy-worker] Downloading: ${file.filename}`);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to download output: ${res.status}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function uploadToS3(buffer: Buffer, key: string): Promise<string> {
  console.log(`[comfy-worker] Uploading to S3: ${key}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: "video/mp4",
    })
  );
  // Return just the S3 key - the API will generate signed URLs when needed
  return key;
}

// ─────────────────────────────────────────────────────────────
// Cleanup - Delete files from ComfyUI to save SSD space
// Requires cleanup-server.js running on the GPU pod (port 3001)
// ─────────────────────────────────────────────────────────────

async function cleanupAfterJob(
  gpu: GpuConfig,
  imageFile: string,
  videoFile: string,
  outputFile: ComfyOutput | null,
  promptId: string
): Promise<void> {
  // Clear ComfyUI history first (this is built-in)
  try {
    await fetch(`${gpu.url}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete: [promptId] }),
    });
    console.log(`[comfy-worker] Cleared history for prompt: ${promptId}`);
  } catch (err) {
    console.log(
      `[comfy-worker] Could not clear history: ${(err as Error).message}`
    );
  }

  // Delete actual files via cleanup server
  if (!gpu.cleanupUrl) {
    console.log(
      `[comfy-worker] No cleanup URL configured for GPU ${gpu.id}, skipping file deletion`
    );
    return;
  }

  console.log(`[comfy-worker] Cleaning up files from GPU...`);

  try {
    const outputs: string[] = [];
    if (outputFile) {
      const outputPath = outputFile.subfolder
        ? `${outputFile.subfolder}/${outputFile.filename}`
        : outputFile.filename;
      outputs.push(outputPath);
    }

    const res = await fetch(`${gpu.cleanupUrl}/cleanup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: [imageFile, videoFile],
        outputs,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      console.log(`[comfy-worker] Cleanup result:`, result);
    } else {
      console.log(`[comfy-worker] Cleanup failed: ${res.status}`);
    }
  } catch (err) {
    console.log(`[comfy-worker] Cleanup error: ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Job Processing
// ─────────────────────────────────────────────────────────────

async function processJob(job: ComfyJob, gpu: GpuConfig): Promise<string> {
  const clientId = crypto.randomUUID();
  let promptId: string | null = null;
  let outputFile: ComfyOutput | null = null;

  try {
    // Build workflow with job's files
    console.log(`[comfy-worker] Building workflow for job ${job.id}`);
    const workflow = buildWorkflow(job.imageFile, job.videoFile);

    // Submit to ComfyUI
    console.log(`[comfy-worker] Submitting to GPU ${gpu.id}`);
    promptId = await submitPrompt(gpu, workflow, clientId);
    console.log(`[comfy-worker] Prompt ID: ${promptId}`);

    // Wait for completion via WebSocket
    const outputs = await waitForCompletion(gpu, promptId, clientId, job.id);
    console.log(`[comfy-worker] Got outputs:`, Object.keys(outputs));

    // Find and download video output
    outputFile = findVideoOutput(outputs);
    if (!outputFile) {
      throw new Error("No video output found in workflow results");
    }

    console.log(`[comfy-worker] Downloading output video`);
    const buffer = await downloadOutput(gpu, outputFile);

    // Upload to S3
    console.log(`[comfy-worker] Uploading to S3`);
    const s3Key = `comfy-outputs/${job.teamId}/${job.id}.mp4`;
    const s3Url = await uploadToS3(buffer, s3Key);

    // TODO: Cleanup files from GPU to save SSD space
    // Requires cleanup-server.js running on RunPod pod (port 3001)
    // await cleanupAfterJob(gpu, job.imageFile, job.videoFile, outputFile, promptId);

    return s3Url;
  } catch (err) {
    // TODO: Still try to cleanup on error once cleanup server is running
    // if (promptId) {
    //   await cleanupAfterJob(gpu, job.imageFile, job.videoFile, outputFile, promptId);
    // }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// UGC Face Swap Parent Job Processing
// ─────────────────────────────────────────────────────────────

const MAX_VIDEO_DURATION = 50;
const CHUNK_DURATION = 10;

interface ChunkInfo {
  sequenceNumber: number;
  startTime: number;
  endTime: number;
  localPath: string;
}

function calculateChunks(
  duration: number,
  chunkSize: number
): Array<{ start: number; end: number }> {
  const chunks: Array<{ start: number; end: number }> = [];
  let start = 0;

  while (start < duration) {
    const end = Math.min(start + chunkSize, duration);
    chunks.push({ start, end });
    start = end;
  }

  return chunks;
}

async function processUGCFaceSwapParentJob(
  job: ComfyJob,
  gpu: GpuConfig
): Promise<string> {
  const outDir = path.join(process.cwd(), "output", `ugc-${Date.now()}`);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const localVideoPath = path.join(outDir, `source_${Date.now()}.mp4`);
  const localImagePath = path.join(outDir, `reference_${Date.now()}.jpg`);

  try {
    console.log(
      `[comfy-worker] Processing UGC Face Swap parent job ${job.id} on GPU ${gpu.id}`
    );

    // imageFile = S3 key for image, videoFile = S3 key for video
    const imageS3Key = job.imageFile;
    const videoS3Key = job.videoFile;

    // Step 1: Download video and image from S3
    console.log(`[comfy-worker] Downloading ${imageS3Key} and ${videoS3Key}`);
    await Promise.all([
      s3Service.downloadFile(videoS3Key, localVideoPath),
      s3Service.downloadFile(imageS3Key, localImagePath),
    ]);

    // Step 2: Get video duration and calculate chunks
    const videoDuration = await getVideoDuration(localVideoPath);
    console.log(`[comfy-worker] Video duration: ${videoDuration}s`);
    const chunks = calculateChunks(videoDuration, CHUNK_DURATION);
    console.log(`[comfy-worker] Splitting video into ${chunks.length} chunks`);

    // Step 3: Cut video into chunks
    const chunkInfos: ChunkInfo[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkPath = path.join(outDir, `chunk_${i}.mp4`);

      try {
        console.log(
          `[comfy-worker] Cutting chunk ${i + 1}/${chunks.length}: ${chunk.start}s - ${chunk.end}s`
        );
        await cutClip(localVideoPath, chunkPath, chunk.start, chunk.end);

        // Only add if file was created (video might be shorter than expected)
        if (fs.existsSync(chunkPath) && fs.statSync(chunkPath).size > 0) {
          chunkInfos.push({
            sequenceNumber: i,
            startTime: chunk.start,
            endTime: chunk.end,
            localPath: chunkPath,
          });
        }
      } catch (err) {
        // If chunk fails to cut, video is probably shorter - stop here
        console.log(
          `[comfy-worker] Chunk ${i} cut failed (video may be shorter), stopping`
        );
        break;
      }
    }

    if (chunkInfos.length === 0) {
      throw new Error("Failed to create any video chunks");
    }

    console.log(
      `[comfy-worker] Created ${chunkInfos.length} chunks for processing`
    );

    // Step 4: Upload initial reference image to GPU
    console.log(`[comfy-worker] Uploading reference image to GPU`);
    let currentReferenceImagePath = localImagePath;
    let gpuImageName = await uploadFileToGpu(gpu, currentReferenceImagePath);

    // Step 5: Process each chunk through ComfyUI
    // Use "golden reference" approach: after chunk 1, extract its first frame
    // and use that SAME reference for ALL subsequent chunks to prevent drift
    const processedChunkPaths: string[] = [];
    let goldenReferencePath: string | null = null;

    for (let i = 0; i < chunkInfos.length; i++) {
      const chunk = chunkInfos[i];

      console.log(`[comfy-worker] Processing chunk ${i + 1}/${chunkInfos.length}...`);

      // Upload chunk video to GPU
      const gpuVideoName = await uploadFileToGpu(gpu, chunk.localPath);

      // Process chunk through ComfyUI
      const clientId = crypto.randomUUID();
      const workflow = buildWorkflow(gpuImageName, gpuVideoName);
      const promptId = await submitPrompt(gpu, workflow, clientId);

      console.log(`[comfy-worker] Chunk ${i} submitted, prompt: ${promptId}`);

      // Wait for completion
      const outputs = await waitForCompletion(gpu, promptId, clientId, job.id);
      const outputFile = findVideoOutput(outputs);

      if (!outputFile) {
        throw new Error(`No output for chunk ${i}`);
      }

      // Download processed chunk
      const buffer = await downloadOutput(gpu, outputFile);
      const processedPath = path.join(outDir, `processed_${i}.mp4`);
      fs.writeFileSync(processedPath, buffer);
      processedChunkPaths.push(processedPath);

      // After chunk 1: extract first frame as "golden reference" for all remaining chunks
      // This prevents drift - the same swapped face is used throughout the video
      if (i === 0 && chunkInfos.length > 1) {
        goldenReferencePath = path.join(outDir, `golden_reference.jpg`);
        await extractFirstFrame(processedPath, goldenReferencePath);
        gpuImageName = await uploadFileToGpu(gpu, goldenReferencePath);
        console.log(`[comfy-worker] Extracted golden reference from chunk 1 for all subsequent chunks`);
      }

      // Update progress after each chunk completes
      const chunkProgress = Math.round(15 + ((i + 1) / chunkInfos.length) * 70);
      await updateProgress(
        job.id,
        job.teamId,
        chunkProgress,
        `Processing: ${Math.round(((i + 1) / chunkInfos.length) * 100)}% complete`
      );

      await extendJobLock(job.id);

      console.log(`[comfy-worker] Chunk ${i + 1} processed successfully`);
    }

    // Step 6: Stitch chunks together
    console.log(`[comfy-worker] Stitching final video...`);
    let finalOutputPath = path.join(outDir, `final_${Date.now()}.mp4`);
    await mergeClips(processedChunkPaths, finalOutputPath);
    console.log(`[comfy-worker] Stitched ${processedChunkPaths.length} chunks`);

    // Step 6.5: Splice assembly (if splice mode enabled)
    console.log(`[comfy-worker] Checking splice mode: spliceMode=${job.spliceMode}, hasMetadata=${!!job.spliceMetadata}, hasOriginal=${!!job.originalVideoS3Key}`);

    if (job.spliceMode && job.spliceMetadata && job.originalVideoS3Key) {
      console.log(`[comfy-worker] Splice mode enabled, assembling full video...`);
      const spliceData = job.spliceMetadata;
      console.log(`[comfy-worker] Splice segments:`, JSON.stringify(spliceData.segments));

      const originalPath = path.join(outDir, `original_${Date.now()}.mp4`);
      await s3Service.downloadFile(job.originalVideoS3Key, originalPath);
      console.log(`[comfy-worker] Downloaded original video for splice`);

      const spliceSegmentPaths: string[] = [];
      let processedOffset = 0;

      for (let i = 0; i < spliceData.segments.length; i++) {
        const seg = spliceData.segments[i];
        const segPath = path.join(outDir, `splice_seg_${i}.mp4`);

        if (seg.type === "processed") {
          const duration = seg.end - seg.start;
          console.log(`[comfy-worker] Splice segment ${i}: PROCESSED ${seg.start}-${seg.end}s (from finalOutput ${processedOffset}-${processedOffset + duration}s)`);
          await cutClip(finalOutputPath, segPath, processedOffset, processedOffset + duration);
          processedOffset += duration;
        } else {
          console.log(`[comfy-worker] Splice segment ${i}: ORIGINAL ${seg.start}-${seg.end}s`);
          await cutClip(originalPath, segPath, seg.start, seg.end);
        }
        spliceSegmentPaths.push(segPath);
      }

      const splicedPath = path.join(outDir, `spliced_final_${Date.now()}.mp4`);
      await mergeClips(spliceSegmentPaths, splicedPath);
      finalOutputPath = splicedPath;
      console.log(`[comfy-worker] Spliced ${spliceSegmentPaths.length} segments into full video`);
    } else {
      console.log(`[comfy-worker] Splice mode NOT enabled - outputting processed segments only`);
    }

    // Step 7: Upload final video to S3
    console.log(`[comfy-worker] Uploading final video to S3...`);
    const finalBuffer = fs.readFileSync(finalOutputPath);
    const s3Key = `comfy-outputs/${job.teamId}/${job.id}/final.mp4`;
    const s3Url = await uploadToS3(finalBuffer, s3Key);

    console.log(`[comfy-worker] UGC Face Swap job ${job.id} completed!`);
    return s3Url;
  } finally {
    // Cleanup local files
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
      console.log(`[comfy-worker] Cleaned up temp directory: ${outDir}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Main Loop (Parallel GPU Processing)
// ─────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Track which GPUs are currently busy
const busyGpus = new Set<string>();

async function processJobOnGpu(job: ComfyJob, gpu: GpuConfig): Promise<void> {
  try {
    console.log(
      `[comfy-worker] Processing job ${job.id} (${job.jobType}) on GPU ${gpu.id}`
    );

    let outputS3Key: string;

    if (job.jobType === "ugc-face-swap-parent") {
      outputS3Key = await processUGCFaceSwapParentJob(job, gpu);
    } else {
      outputS3Key = await processJob(job, gpu);
    }

    const outputUrl = await s3Service.getPresignedUrl(outputS3Key, 3600);
    await completeJob(job.id, job.teamId, true, outputS3Key, outputUrl);

    if (job.jobType === "ugc-face-swap-parent") {
      try {
        const [member] = await db
          .select({ userId: teamMembers.user_id })
          .from(teamMembers)
          .where(eq(teamMembers.team_id, job.teamId))
          .limit(1);

        if (member) {
          const [clip] = await db
            .insert(clips)
            .values({
              team_id: job.teamId,
              generated_by_user_id: member.userId,
              clip_path: outputS3Key,
              blank_video_path: outputS3Key,
              source_video_path: job.videoFile,
              status: "completed",
              saved: true,
              clip_metadata: { type: "face-swap", comfyJobId: job.id },
              title: "UGC Face Swap",
            })
            .returning();
          console.log(`[comfy-worker] Created clip ${clip.id} in library`);

          try {
            const tempDir = path.join(process.cwd(), "output", `transcribe-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });
            const tempVideoPath = path.join(tempDir, "video.mp4");

            await s3Service.downloadFile(outputS3Key, tempVideoPath);
            const transcriptionData = await transcribeVideoService(tempVideoPath);
            const words = transcriptionData.results.channels[0].alternatives[0].words;
            const captionsData = convertWordsToCaptionEntries(words);
            const srtContent = generateSrtFromCaptions(captionsData);
            const srtPath = path.join(tempDir, `captions_${clip.id}.srt`);
            fs.writeFileSync(srtPath, srtContent);
            const srtS3Key = await s3Service.uploadSrtFile(srtPath, job.teamId, clip.id);

            await db.update(clips).set({
              captions_data: captionsData,
              srt_path: srtS3Key,
            }).where(eq(clips.id, clip.id));

            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log(`[comfy-worker] Added captions to clip ${clip.id}`);
          } catch (transcribeErr) {
            console.error(`[comfy-worker] Transcription failed:`, (transcribeErr as Error).message);
          }

          // Credits already charged upfront in controller - no charge needed on success

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, member.userId))
            .limit(1);

          if (user) {
            const frontendUrl = process.env.FRONTEND_URL || "https://platform.cuttr.com";
            await emailNotiService.sendClipsReady(user.email, {
              userName: user.first_name || "there",
              clipCount: 1,
              sourceFileName: "UGC Face Swap",
              clipsUrl: `${frontendUrl}/dashboard/ugc-studio`,
            });
            console.log(`[comfy-worker] Sent email notification to ${user.email}`);
          }
        }
      } catch (clipErr) {
        console.error(`[comfy-worker] Failed to create clip or notify:`, (clipErr as Error).message);
      }
    }

    console.log(`[comfy-worker] Job ${job.id} completed successfully on ${gpu.id}`);
  } catch (err) {
    console.error(
      `[comfy-worker] Job ${job.id} failed on ${gpu.id}:`,
      (err as Error).message
    );
    try {
      await completeJob(job.id, job.teamId, false, undefined, undefined, (err as Error).message);

      // Refund credits on failure (5 credits charged upfront in controller)
      if (job.jobType === "ugc-face-swap-parent") {
        await teamService.decrementTeamUsage(job.teamId, 5);
        console.log(`[comfy-worker] Refunded 5 credits to team ${job.teamId} due to job failure`);
      }
    } catch (dbErr) {
      console.error(`[comfy-worker] Failed to update job status in DB:`, (dbErr as Error).message);
    }
  } finally {
    busyGpus.delete(gpu.id);
    await releaseJobLock(job.id);
  }
}

async function findAvailableGpu(): Promise<GpuConfig | null> {
  // Try each GPU in order, skipping locally busy ones
  for (const gpu of gpuConfig.gpus) {
    if (busyGpus.has(gpu.id)) {
      console.log(`[comfy-worker] GPU ${gpu.id} locally busy, trying next...`);
      continue;
    }

    try {
      const status = await checkGpuAvailability(gpu);
      if (status.available) {
        console.log(`[comfy-worker] GPU ${gpu.id} available (queue: ${status.queueRemaining})`);
        return gpu;
      } else {
        console.log(`[comfy-worker] GPU ${gpu.id} busy (queue: ${status.queueRemaining}), trying next...`);
      }
    } catch (err) {
      console.log(`[comfy-worker] GPU ${gpu.id} unreachable, trying next...`);
    }
  }
  return null;
}

async function getQueuedJobCount(): Promise<number> {
  try {
    const result = await db
      .select({ id: comfyJobs.id })
      .from(comfyJobs)
      .where(
        and(
          eq(comfyJobs.status, "queued"),
          inArray(comfyJobs.jobType, ["single", "ugc-face-swap-chunk", "ugc-face-swap-parent"])
        )
      )
      .limit(20);
    return result.length;
  } catch {
    return 0;
  }
}

async function runWorkerLoop(): Promise<void> {
  console.log("[comfy-worker] Starting ComfyUI worker loop (parallel mode)");
  console.log(`[comfy-worker] Loaded ${gpuConfig.gpus.length} GPU(s)`);

  let consecutiveIdleCycles = 0;

  while (isRunning) {
    try {
      // Step 1: Find an available GPU (tries ALL GPUs)
      const availableGpu = await findAvailableGpu();
      if (!availableGpu) {
        const queuedCount = await getQueuedJobCount();
        const waitTime = queuedCount > 0 ? 5000 : 20000;
        console.log(`[comfy-worker] All GPUs busy, ${queuedCount} jobs queued, retrying in ${waitTime / 1000}s...`);
        await sleep(waitTime);
        continue;
      }

      // Step 2: Mark GPU busy IMMEDIATELY (prevents race conditions)
      busyGpus.add(availableGpu.id);

      // Step 3: Get a job (GPU is now reserved)
      const job = await getNextJob();
      if (!job) {
        busyGpus.delete(availableGpu.id);
        const queuedCount = await getQueuedJobCount();
        if (queuedCount > 0) {
          console.log(`[comfy-worker] No job claimed but ${queuedCount} in queue, retrying quickly...`);
          await sleep(2000);
        } else {
          consecutiveIdleCycles++;
          const idleWait = Math.min(5000 + consecutiveIdleCycles * 2000, 20000);
          await sleep(idleWait);
        }
        continue;
      }

      consecutiveIdleCycles = 0;

      // Step 4: Dispatch job (non-blocking for parallel GPU usage)
      console.log(`[comfy-worker] Dispatching job ${job.id} to GPU ${availableGpu.id}`);
      processJobOnGpu(job, availableGpu)
        .then(() => {
          console.log(`[comfy-worker] Job ${job.id} completed on GPU ${availableGpu.id}`);
        })
        .catch((err) => {
          console.error(`[comfy-worker] Job ${job.id} failed:`, err);
        });

      // Quick check - if more jobs queued, loop immediately to grab another GPU
      const remainingQueued = await getQueuedJobCount();
      if (remainingQueued > 0) {
        console.log(`[comfy-worker] ${remainingQueued} more jobs queued, checking for available GPU...`);
        await sleep(500);
      } else {
        await sleep(2000);
      }
    } catch (err) {
      console.error("[comfy-worker] Main loop error:", (err as Error).message);
      await sleep(10000);
    }
  }

  console.log("[comfy-worker] Worker loop stopped");
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function startComfyWorker(): void {
  if (isRunning) {
    console.log("[comfy-worker] Worker already running");
    return;
  }

  isRunning = true;
  runWorkerLoop().catch((err) => {
    console.error("[comfy-worker] Worker crashed:", err);
    isRunning = false;
  });
}

export function stopComfyWorker(): void {
  console.log("[comfy-worker] Stopping worker...");
  isRunning = false;
}

export function isComfyWorkerRunning(): boolean {
  return isRunning;
}
