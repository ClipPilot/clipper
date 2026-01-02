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
import { cutClip, mergeClips } from "./videoEditor.service";
import { emitComfyJobUpdate } from "./socket.service";
import { teamService } from "./team.service";
import { emailNotiService } from "./emailNoti.service";
import { transcribeVideoService } from "./transcription.service";
import { convertWordsToCaptionEntries, generateSrtFromCaptions } from "./captions.service";

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

async function findAvailableGpu(): Promise<GpuConfig | null> {
  for (const gpu of gpuConfig.gpus) {
    const status = await checkGpuAvailability(gpu);
    if (status.available) {
      return gpu;
    }
  }
  return null;
}

async function uploadFileToGpu(
  gpu: GpuConfig,
  filePath: string
): Promise<string> {
  const ext = path.extname(filePath);
  const filename = `${crypto.randomUUID()}${ext}`;

  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer]);

  const form = new FormData();
  form.append("image", blob, filename);
  form.append("type", "input");

  const res = await fetch(`${gpu.url}/upload/image`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const responseBody = await res.text();
    console.error(
      `[comfy-worker] GPU upload failed for ${gpu.id}:`,
      `\n  URL: ${gpu.url}/upload/image`,
      `\n  Status: ${res.status} ${res.statusText}`,
      `\n  Response: ${responseBody}`
    );
    throw new Error(`GPU upload failed (${res.status}): ${responseBody}`);
  }

  const data = (await res.json()) as { name: string };
  console.log(
    `[comfy-worker] Uploaded ${path.basename(filePath)} to GPU ${gpu.id} as ${data.name}`
  );
  return data.name;
}

// ─────────────────────────────────────────────────────────────
// Database Operations
// ─────────────────────────────────────────────────────────────

async function getNextJob(): Promise<ComfyJob | null> {
  try {
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
      .limit(1);

    if (jobs.length === 0) return null;

    const job = jobs[0];

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
    };
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

    const resetTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(
        () => {
          ws.close();
          reject(new Error("Workflow execution timed out after 60 minutes"));
        },
        60 * 60 * 1000
      );
    };

    resetTimeout();

    ws.on("open", () => {
      console.log("[comfy-worker] WebSocket connected");
    });

    ws.on("message", async (rawData) => {
      resetTimeout();

      // Skip binary messages (preview images)
      if (Buffer.isBuffer(rawData) && rawData[0] !== 0x7b) {
        // Not a JSON message (doesn't start with '{'), skip silently
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

        // Debug: log all message types
        console.log(
          `[comfy-worker] WS message: ${msg.type}`,
          msg.data?.prompt_id === promptId ? "(our job)" : ""
        );

        // Execution started (log only, no DB write)
        if (msg.type === "execution_start" && msg.data.prompt_id === promptId) {
          console.log("[comfy-worker] Execution started");
        }

        // Currently executing node (node=null means workflow finished)
        if (msg.type === "executing" && msg.data.prompt_id === promptId) {
          const node = msg.data.node;
          if (node) {
            const nodeMeta =
              (workflowTemplate[node] as { _meta?: { title?: string } })?._meta
                ?.title || node;
            console.log(`[comfy-worker] Executing: ${nodeMeta}`);
          } else {
            // node is null = all nodes finished executing
            console.log("[comfy-worker] Workflow finished (node=null)");
            if (timeout) clearTimeout(timeout);
            ws.close();

            // Fetch outputs from history
            const histRes = await fetch(`${gpu.url}/history/${promptId}`);
            const hist = (await histRes.json()) as Record<string, unknown>;
            const promptData = hist[promptId] as
              | { outputs?: WorkflowOutputs }
              | undefined;
            const outputs = promptData?.outputs;

            if (outputs) {
              console.log(
                "[comfy-worker] Got outputs from nodes:",
                Object.keys(outputs)
              );
              resolve(outputs);
            } else {
              reject(new Error("No outputs found in history"));
            }
            return; // Exit early to prevent further processing
          }
        }

        // Execution complete
        if (
          msg.type === "execution_complete" &&
          msg.data.prompt_id === promptId
        ) {
          console.log("[comfy-worker] Execution complete");
          if (timeout) clearTimeout(timeout);
          ws.close();

          // Fetch outputs from history
          const histRes = await fetch(`${gpu.url}/history/${promptId}`);
          const hist = (await histRes.json()) as Record<string, unknown>;

          // Debug: log full history response
          console.log(
            "[comfy-worker] History response:",
            JSON.stringify(hist, null, 2)
          );

          const promptData = hist[promptId] as
            | { outputs?: WorkflowOutputs }
            | undefined;
          const outputs = promptData?.outputs;

          console.log(
            "[comfy-worker] Outputs keys:",
            outputs ? Object.keys(outputs) : "none"
          );
          if (outputs) {
            // Log each output node's structure
            for (const [nodeId, nodeOut] of Object.entries(outputs)) {
              console.log(
                `[comfy-worker] Node ${nodeId} output keys:`,
                Object.keys(nodeOut)
              );
            }
            resolve(outputs);
          } else {
            reject(new Error("No outputs found in history"));
          }
        }

        // Execution error
        if (msg.type === "execution_error" && msg.data.prompt_id === promptId) {
          if (timeout) clearTimeout(timeout);
          ws.close();
          const errMsg =
            msg.data.exception_message || msg.data.message || "Unknown error";
          reject(new Error(`Execution error: ${errMsg}`));
        }
      } catch (err) {
        console.error(
          "[comfy-worker] Error parsing message:",
          (err as Error).message
        );
      }
    });

    ws.on("error", (err) => {
      console.error("[comfy-worker] WebSocket error:", err.message);
      if (timeout) clearTimeout(timeout);
      reject(err);
    });

    ws.on("close", () => {
      console.log("[comfy-worker] WebSocket closed");
      if (timeout) clearTimeout(timeout);
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

const MAX_VIDEO_DURATION = 30;
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
    // For now, we'll assume the video is already validated to be <= 30s by the controller
    // We could use ffprobe here to get exact duration, but for simplicity use a fixed chunk strategy
    const videoDuration = MAX_VIDEO_DURATION;
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

    // Step 4: Upload image to GPU once (shared across all chunks)
    console.log(`[comfy-worker] Uploading reference image to GPU`);
    const gpuImageName = await uploadFileToGpu(gpu, localImagePath);

    // Step 5: Process each chunk through ComfyUI
    const processedChunkPaths: string[] = [];

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

      // Update progress after each chunk completes
      const chunkProgress = Math.round(15 + ((i + 1) / chunkInfos.length) * 70);
      await updateProgress(
        job.id,
        job.teamId,
        chunkProgress,
        `Completed chunk ${i + 1}/${chunkInfos.length}`
      );

      console.log(`[comfy-worker] Chunk ${i + 1} processed successfully`);
    }

    // Step 6: Stitch chunks together
    console.log(`[comfy-worker] Stitching final video...`);
    const finalOutputPath = path.join(outDir, `final_${Date.now()}.mp4`);
    await mergeClips(processedChunkPaths, finalOutputPath);
    console.log(`[comfy-worker] Stitched ${processedChunkPaths.length} chunks`);

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
  busyGpus.add(gpu.id);

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

          await teamService.incrementTeamUsage(job.teamId, 5);
          console.log(`[comfy-worker] Charged 5 credits to team ${job.teamId}`);

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
    } catch (dbErr) {
      console.error(`[comfy-worker] Failed to update job status in DB:`, (dbErr as Error).message);
    }
  } finally {
    busyGpus.delete(gpu.id);
  }
}

function getLocallyFreeGpu(): GpuConfig | null {
  // Returns first GPU not currently tracked as busy (no HTTP call)
  for (const gpu of gpuConfig.gpus) {
    if (!busyGpus.has(gpu.id)) {
      return gpu;
    }
  }
  return null;
}

async function runWorkerLoop(): Promise<void> {
  console.log("[comfy-worker] Starting ComfyUI worker loop (parallel mode)");
  console.log(`[comfy-worker] Loaded ${gpuConfig.gpus.length} GPU(s)`);

  while (isRunning) {
    try {
      // Step 1: Check if ANY GPU is locally free (no HTTP call)
      const locallyFreeGpu = getLocallyFreeGpu();
      if (!locallyFreeGpu) {
        // All GPUs busy - sleep longer, no need to poll
        await sleep(5000);
        continue;
      }

      // Step 2: Only query DB if we have a potentially free GPU
      const job = await getNextJob();
      if (!job) {
        // No jobs - sleep longer
        await sleep(5000);
        continue;
      }

      // Step 3: Only NOW check GPU HTTP availability (we have a job to run)
      const status = await checkGpuAvailability(locallyFreeGpu);
      if (!status.available) {
        // GPU not actually ready - put job back and try again
        await sleep(2000);
        continue;
      }

      // Step 4: Dispatch job WITHOUT awaiting - allows parallel processing
      processJobOnGpu(job, locallyFreeGpu).catch((err) => {
        console.error(`[comfy-worker] Unexpected error:`, err);
      });

      // Small delay before checking for more work
      await sleep(1000);
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
