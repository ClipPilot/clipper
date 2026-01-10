import * as Sentry from "@sentry/node";
import WebSocket from "ws";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "../db";
import {
  comfyJobs,
  teamMembers,
  clips,
  users,
} from "@clipper/shared-db/src/schema";
import { eq } from "drizzle-orm";
import { config } from "../config/env";
import { s3Service } from "../services/s3.service";
import {
  cutClip,
  mergeClipsGpu,
  extractFirstFrame,
  // extractAudio, // Only used for sync.so lip sync
} from "../services/videoEditor.service";
// import { syncService } from "../services/sync.service";
import { ComfyJobUpdate } from "../services/socket.service";
import { teamService } from "../services/team.service";
import { emailNotiService } from "../services/emailNoti.service";
import { transcribeVideoService } from "../services/transcription.service";
import {
  convertWordsToCaptionEntries,
  generateSrtFromCaptions,
} from "../services/captions.service";
import { GpuJobMessage, SpliceSegmentInfo } from "../services/gpuSqs.service";

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL || "http://localhost:3001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

async function emitJobUpdate(
  teamId: number,
  job: ComfyJobUpdate
): Promise<void> {
  try {
    const response = await fetch(
      `${API_INTERNAL_URL}/internal/notify/comfy-job-update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": INTERNAL_API_KEY,
        },
        body: JSON.stringify({ teamId, job }),
      }
    );
    if (!response.ok) {
      console.error(
        `[gpu-worker] Failed to emit job update: ${response.status}`
      );
    }
  } catch (err) {
    console.error(
      `[gpu-worker] Error emitting job update:`,
      (err as Error).message
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Types & Configuration
// ─────────────────────────────────────────────────────────────

interface GpuConfig {
  id: string;
  name: string;
  url: string;
  cleanupUrl?: string;
}

interface GpuConfigFile {
  gpus: GpuConfig[];
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

// Load GPU and workflow configs
const configDir = path.join(__dirname, "../config/comfy");
const gpuConfig: GpuConfigFile = JSON.parse(
  fs.readFileSync(path.join(configDir, "gpus.config.json"), "utf-8")
);

// Load all workflow templates
const workflowFullBody = JSON.parse(
  fs.readFileSync(path.join(configDir, "workflow.json"), "utf-8")
);
const workflowFaceOnly = JSON.parse(
  fs.readFileSync(path.join(configDir, "workflow_face_only.json"), "utf-8")
);
const workflowNewFaceRaw = JSON.parse(
  fs.readFileSync(path.join(configDir, "newFaceRawWorkflow.json"), "utf-8")
);

// Legacy alias for backwards compatibility
const workflowTemplate = workflowFullBody;

const s3 = new S3Client({ region: config.aws.region });

const ASSIGNED_GPU_ID = process.env.GPU_ID || null;

function getAssignedGpu(): GpuConfig | null {
  if (!ASSIGNED_GPU_ID) return null;
  return gpuConfig.gpus.find((g) => g.id === ASSIGNED_GPU_ID) || null;
}

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
      `[gpu-worker] GPU ${gpu.id} check failed:`,
      (err as Error).message
    );
    return { available: false };
  }
}

async function findAvailableGpu(): Promise<GpuConfig | null> {
  const assignedGpu = getAssignedGpu();

  if (assignedGpu) {
    const status = await checkGpuAvailability(assignedGpu);
    if (status.available) {
      console.log(`[gpu-worker] Assigned GPU ${assignedGpu.id} available`);
      return assignedGpu;
    }
    console.log(
      `[gpu-worker] Assigned GPU ${assignedGpu.id} busy (queue: ${status.queueRemaining})`
    );
    return null;
  }

  for (const gpu of gpuConfig.gpus) {
    try {
      const status = await checkGpuAvailability(gpu);
      if (status.available) {
        console.log(
          `[gpu-worker] GPU ${gpu.id} available (queue: ${status.queueRemaining})`
        );
        return gpu;
      }
      console.log(
        `[gpu-worker] GPU ${gpu.id} busy (queue: ${status.queueRemaining})`
      );
    } catch {
      console.log(`[gpu-worker] GPU ${gpu.id} unreachable`);
    }
  }
  return null;
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
        `[gpu-worker] GPU upload failed for ${gpu.id}:`,
        `\n  Status: ${res.status} ${res.statusText}`,
        `\n  Response: ${responseBody.slice(0, 200)}`
      );
      throw new Error(`GPU upload failed (${res.status})`);
    }

    const data = (await res.json()) as { name: string };
    console.log(
      `[gpu-worker] Uploaded ${path.basename(filePath)} to GPU ${gpu.id} as ${data.name}`
    );
    return data.name;
  } catch (err) {
    clearTimeout(timeoutId);

    const isTimeout = err instanceof Error && err.name === "AbortError";
    const errMsg = isTimeout
      ? "timeout"
      : err instanceof Error
        ? err.message
        : String(err);

    if (retryCount < UPLOAD_MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(
        `[gpu-worker] Upload to ${gpu.id} failed (${errMsg}), retry ${retryCount + 1}/${UPLOAD_MAX_RETRIES} in ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
      return uploadFileToGpu(gpu, filePath, retryCount + 1);
    }

    throw new Error(
      `GPU upload failed after ${UPLOAD_MAX_RETRIES} retries: ${errMsg}`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Database Operations
// ─────────────────────────────────────────────────────────────

async function startJobProcessing(job: GpuJobMessage): Promise<string> {
  await db
    .update(comfyJobs)
    .set({
      status: "running",
      progress: 5,
      progressMessage: "Starting GPU processing",
      startedAt: new Date(),
    })
    .where(eq(comfyJobs.id, job.jobId));

  emitJobUpdate(job.teamId, {
    id: job.jobId,
    status: "running",
    progress: 5,
    progressMessage: "Starting GPU processing",
    outputUrl: null,
    errorMessage: null,
    finishedAt: null,
  });

  return job.jobId;
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

  emitJobUpdate(teamId, {
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

  emitJobUpdate(teamId, {
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
  videoFile: string,
  swapType: "face" | "fullBody" = "face"
): Record<string, unknown> {
  // Select the appropriate workflow template based on swap type
  // Face swap uses the new WanAnimate workflow (newFaceRawWorkflow.json)
  // Full body swap uses the original workflow (workflow.json)
  const template = swapType === "face" ? workflowNewFaceRaw : workflowFullBody;
  const workflow = JSON.parse(JSON.stringify(template));

  if (swapType === "face") {
    // New face swap workflow (newFaceRawWorkflow.json) node mappings:
    // - Node 57: LoadImage (titled "Load Face") - reference image input
    // - Node 254: VHS_LoadVideo - video input
    if (workflow["57"]?.inputs) {
      workflow["57"].inputs.image = imageFile;
    }
    if (workflow["254"]?.inputs) {
      workflow["254"].inputs.video = videoFile;
    }
  } else {
    // Full body workflow (workflow.json) node mappings:
    // - Node 311: LoadImage - reference image input
    // - Node 417: VHS_LoadVideo - video input
    if (workflow["311"]?.inputs) {
      workflow["311"].inputs.image = imageFile;
    }
    if (workflow["417"]?.inputs) {
      workflow["417"].inputs.video = videoFile;
    }
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
    console.log(`[gpu-worker] Connecting to WebSocket`);

    const ws = new WebSocket(wsUrl);
    let timeout: NodeJS.Timeout | null = null;
    let settled = false;
    let intentionalClose = false; // Track if we're closing intentionally
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
          safeReject(
            new Error("Workflow execution timed out after 60 minutes")
          );
        },
        60 * 60 * 1000
      );
    };

    resetTimeout();

    ws.on("open", () => {
      console.log("[gpu-worker] WebSocket connected");
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
          `[gpu-worker] WS message: ${msg.type}`,
          msg.data?.prompt_id === promptId ? "(our job)" : ""
        );

        if (msg.type === "executing" && msg.data.prompt_id === promptId) {
          const node = msg.data.node;
          if (node) {
            const nodeMeta =
              (workflowTemplate[node] as { _meta?: { title?: string } })?._meta
                ?.title || node;
            console.log(`[gpu-worker] Executing: ${nodeMeta}`);
          } else {
            console.log("[gpu-worker] Workflow finished (node=null)");
            intentionalClose = true;
            ws.close();

            try {
              const histRes = await fetch(`${gpu.url}/history/${promptId}`);
              const hist = (await histRes.json()) as Record<string, unknown>;
              const promptData = hist[promptId] as
                | { outputs?: WorkflowOutputs }
                | undefined;
              const outputs = promptData?.outputs;

              if (outputs) {
                console.log(
                  "[gpu-worker] Got outputs from nodes:",
                  Object.keys(outputs)
                );
                safeResolve(outputs);
              } else {
                safeReject(new Error("No outputs found in history"));
              }
            } catch (fetchErr) {
              safeReject(
                new Error(
                  `Failed to fetch history: ${(fetchErr as Error).message}`
                )
              );
            }
            return;
          }
        }

        if (
          msg.type === "execution_complete" &&
          msg.data.prompt_id === promptId
        ) {
          console.log("[gpu-worker] Execution complete");
          intentionalClose = true;
          ws.close();

          try {
            const histRes = await fetch(`${gpu.url}/history/${promptId}`);
            const hist = (await histRes.json()) as Record<string, unknown>;
            const promptData = hist[promptId] as
              | { outputs?: WorkflowOutputs }
              | undefined;
            const outputs = promptData?.outputs;

            if (outputs) {
              safeResolve(outputs);
            } else {
              safeReject(new Error("No outputs found in history"));
            }
          } catch (fetchErr) {
            safeReject(
              new Error(
                `Failed to fetch history: ${(fetchErr as Error).message}`
              )
            );
          }
        }

        if (msg.type === "execution_error" && msg.data.prompt_id === promptId) {
          intentionalClose = true;
          ws.close();
          const errMsg =
            msg.data.exception_message || msg.data.message || "Unknown error";
          safeReject(new Error(`Execution error: ${errMsg}`));
        }
      } catch (err) {
        console.error(
          "[gpu-worker] Error parsing message:",
          (err as Error).message
        );
      }
    });

    ws.on("error", (err) => {
      console.error("[gpu-worker] WebSocket error:", err.message);
      safeReject(err);
    });

    ws.on("close", () => {
      console.log("[gpu-worker] WebSocket closed");
      // Only reject if this was an unexpected close (not triggered by us after success/error)
      if (!settled && !intentionalClose) {
        const silentDuration = Date.now() - lastMessageTime;
        safeReject(
          new Error(
            `WebSocket closed unexpectedly (last message ${Math.round(silentDuration / 1000)}s ago)`
          )
        );
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Output Handling
// ─────────────────────────────────────────────────────────────

function findVideoOutput(outputs: WorkflowOutputs): ComfyOutput | null {
  // Check node 30 first (new face swap workflow - VHS_VideoCombine output)
  const node30 = outputs["30"] as Record<string, ComfyOutput[]> | undefined;
  if (node30) {
    const video =
      node30.gifs?.[0] || node30.videos?.[0] || node30.images?.[0];
    if (video) {
      console.log("[gpu-worker] Found output in node 30 (new face swap):", video);
      return video;
    }
  }

  // Check node 467 (RIFE interpolated - higher quality, original face workflow)
  const node467 = outputs["467"] as Record<string, ComfyOutput[]> | undefined;
  if (node467) {
    const video =
      node467.gifs?.[0] || node467.videos?.[0] || node467.images?.[0];
    if (video) {
      console.log("[gpu-worker] Found output in node 467:", video);
      return video;
    }
  }

  // Check node 462 (base output, original face workflow)
  const node462 = outputs["462"] as Record<string, ComfyOutput[]> | undefined;
  if (node462) {
    const video =
      node462.gifs?.[0] || node462.videos?.[0] || node462.images?.[0];
    if (video) {
      console.log("[gpu-worker] Found output in node 462:", video);
      return video;
    }
  }

  // Fallback: search all nodes for any video-like output
  for (const [nodeId, nodeOutput] of Object.entries(outputs)) {
    const output = nodeOutput as Record<string, ComfyOutput[]>;
    const video = output.gifs?.[0] || output.videos?.[0] || output.images?.[0];
    if (video && video.filename?.includes(".mp4")) {
      console.log(`[gpu-worker] Found mp4 in node ${nodeId}:`, video);
      return video;
    }
  }

  console.log("[gpu-worker] No video output found!");
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

  console.log(`[gpu-worker] Downloading: ${file.filename}`);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to download output: ${res.status}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function uploadToS3(buffer: Buffer, key: string): Promise<string> {
  console.log(`[gpu-worker] Uploading to S3: ${key}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: "video/mp4",
    })
  );
  return key;
}

// ─────────────────────────────────────────────────────────────
// Main GPU Job Processor
// ─────────────────────────────────────────────────────────────

export async function processGpuJob(job: GpuJobMessage): Promise<void> {
  const outDir = path.join(process.cwd(), "output", `ugc-${Date.now()}`);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const localImagePath = path.join(outDir, `reference_${Date.now()}.jpg`);

  let jobId: string | null = null;

  try {
    jobId = await startJobProcessing(job);
    console.log(`[gpu-worker] Started processing job: ${jobId}`);

    let gpu: GpuConfig | null = null;

    while (!gpu) {
      gpu = await findAvailableGpu();
      if (!gpu) {
        console.log(`[gpu-worker] No GPU available, waiting...`);
        await updateProgress(jobId, job.teamId, 5, `Waiting for GPU`);
        await new Promise((r) => setTimeout(r, 60000));
      }
    }

    console.log(`[gpu-worker] Using GPU ${gpu.id}`);
    console.log(
      `[gpu-worker] Swap type: ${job.swapType || "face"} (${job.swapType === "fullBody" ? "full body" : "face only"})`
    );
    await updateProgress(jobId, job.teamId, 10, "Downloading files from S3");

    console.log(
      `[gpu-worker] Downloading ${job.chunkS3Keys.length} chunks and reference image`
    );
    await s3Service.downloadFile(job.imageS3Key, localImagePath);

    const chunkLocalPaths: string[] = [];
    for (let i = 0; i < job.chunkS3Keys.length; i++) {
      const chunkPath = path.join(outDir, `chunk_${i}.mp4`);
      await s3Service.downloadFile(job.chunkS3Keys[i], chunkPath);
      if (fs.existsSync(chunkPath) && fs.statSync(chunkPath).size > 0) {
        chunkLocalPaths.push(chunkPath);
      } else {
        throw new Error(`Failed to download chunk ${i}`);
      }
    }

    console.log(
      `[gpu-worker] Downloaded ${chunkLocalPaths.length} chunks for processing`
    );
    await updateProgress(
      jobId,
      job.teamId,
      15,
      `Processing ${chunkLocalPaths.length} video segments`
    );

    console.log(`[gpu-worker] Uploading reference image to GPU`);
    let gpuImageName = await uploadFileToGpu(gpu, localImagePath);

    const processedChunkPaths: string[] = [];
    let goldenReferencePath: string | null = null;

    for (let i = 0; i < chunkLocalPaths.length; i++) {
      const chunkPath = chunkLocalPaths[i];
      console.log(
        `[gpu-worker] Processing chunk ${i + 1}/${chunkLocalPaths.length}...`
      );

      const gpuVideoName = await uploadFileToGpu(gpu, chunkPath);
      const clientId = crypto.randomUUID();
      const workflow = buildWorkflow(
        gpuImageName,
        gpuVideoName,
        job.swapType || "face"
      );
      const promptId = await submitPrompt(gpu, workflow, clientId);

      console.log(`[gpu-worker] Chunk ${i} submitted, prompt: ${promptId}`);

      const outputs = await waitForCompletion(gpu, promptId, clientId, jobId);
      const outputFile = findVideoOutput(outputs);

      if (!outputFile) {
        throw new Error(`No output for chunk ${i}`);
      }

      const buffer = await downloadOutput(gpu, outputFile);
      const processedPath = path.join(outDir, `processed_${i}.mp4`);
      fs.writeFileSync(processedPath, buffer);
      processedChunkPaths.push(processedPath);

      if (i === 0 && chunkLocalPaths.length > 1) {
        goldenReferencePath = path.join(outDir, `golden_reference.jpg`);
        await extractFirstFrame(processedPath, goldenReferencePath);
        gpuImageName = await uploadFileToGpu(gpu, goldenReferencePath);
        console.log(`[gpu-worker] Extracted golden reference from chunk 1`);
      }

      const chunkProgress = Math.round(
        20 + ((i + 1) / chunkLocalPaths.length) * 60
      );
      await updateProgress(
        jobId,
        job.teamId,
        chunkProgress,
        `Processing: ${i + 1}/${chunkLocalPaths.length} segments complete`
      );
      console.log(`[gpu-worker] Chunk ${i + 1} processed successfully`);
    }

    // Step 8: Stitch chunks together
    console.log(`[gpu-worker] Stitching final video...`);
    await updateProgress(jobId, job.teamId, 85, "Stitching video segments");

    let finalOutputPath = path.join(outDir, `final_${Date.now()}.mp4`);
    await mergeClipsGpu(processedChunkPaths, finalOutputPath);
    console.log(`[gpu-worker] Stitched ${processedChunkPaths.length} chunks`);

    // Step 9: Splice assembly (if splice mode enabled)
    if (job.spliceMode && job.spliceMetadata && job.originalVideoS3Key) {
      console.log(`[gpu-worker] Splice mode enabled, assembling full video...`);
      await updateProgress(
        jobId,
        job.teamId,
        90,
        "Assembling final video with splice"
      );

      const spliceData = job.spliceMetadata;
      console.log(
        `[gpu-worker] Splice segments:`,
        JSON.stringify(spliceData.segments)
      );

      const originalPath = path.join(outDir, `original_${Date.now()}.mp4`);
      await s3Service.downloadFile(job.originalVideoS3Key, originalPath);
      console.log(`[gpu-worker] Downloaded original video for splice`);

      const CHUNK_DURATION = 10;
      const CHUNK_LEEWAY = 1;

      function getChunkCount(duration: number): number {
        if (duration <= CHUNK_DURATION + CHUNK_LEEWAY) return 1;
        let count = 0;
        let start = 0;
        while (start < duration) {
          count++;
          const remaining = duration - start;
          if (remaining <= CHUNK_DURATION + CHUNK_LEEWAY) break;
          start += CHUNK_DURATION;
        }
        return count;
      }

      const spliceSegmentPaths: string[] = [];
      const spliceSegmentS3Keys: SpliceSegmentInfo[] = [];
      let processedIndex = 0;

      for (let i = 0; i < spliceData.segments.length; i++) {
        const seg = spliceData.segments[i];
        const segPath = path.join(outDir, `splice_seg_${i}.mp4`);

        if (seg.type === "processed") {
          const duration = seg.end - seg.start;
          const numChunks = getChunkCount(duration);
          const chunksForSegment = processedChunkPaths.slice(
            processedIndex,
            processedIndex + numChunks
          );
          processedIndex += numChunks;

          console.log(
            `[gpu-worker] Splice segment ${i}: PROCESSED ${seg.start}-${seg.end}s (${duration}s) using ${numChunks} chunks`
          );

          if (chunksForSegment.length === 1) {
            fs.copyFileSync(chunksForSegment[0], segPath);
          } else {
            await mergeClipsGpu(chunksForSegment, segPath);
          }
        } else {
          console.log(
            `[gpu-worker] Splice segment ${i}: ORIGINAL ${seg.start}-${seg.end}s`
          );
          await cutClip(originalPath, segPath, seg.start, seg.end);
        }
        spliceSegmentPaths.push(segPath);

        const segBuffer = fs.readFileSync(segPath);
        const segS3Key = `comfy-outputs/${job.teamId}/${jobId}/segment_${i}_${seg.type}.mp4`;
        await uploadToS3(segBuffer, segS3Key);
        spliceSegmentS3Keys.push({
          s3Key: segS3Key,
          type: seg.type,
          start: seg.start,
          end: seg.end,
        });
        console.log(`[gpu-worker] Uploaded segment ${i} to S3: ${segS3Key}`);
      }

      const splicedPath = path.join(outDir, `spliced_final_${Date.now()}.mp4`);
      await mergeClipsGpu(spliceSegmentPaths, splicedPath);
      finalOutputPath = splicedPath;
      console.log(
        `[gpu-worker] Spliced ${spliceSegmentPaths.length} segments into full video`
      );

      job.spliceSegmentS3Keys = spliceSegmentS3Keys;

      await db
        .update(comfyJobs)
        .set({
          spliceMetadata: {
            ...spliceData,
            processedSegments: spliceSegmentS3Keys,
          },
        })
        .where(eq(comfyJobs.id, jobId));
      console.log(`[gpu-worker] Updated job with splice segment S3 keys`);
    }

    // Step 10: Apply lip sync polish (if configured)
    // DISABLED: sync.so integration commented out
    // if (syncService.isConfigured() && job.originalVideoS3Key) {
    //   console.log(`[gpu-worker] Applying lip sync polish...`);
    //   await updateProgress(jobId, job.teamId, 88, "Applying polish (lip sync)");

    //   try {
    //     // Upload face-swapped video to get a URL for sync.so
    //     const tempVideoKey = `temp-sync/${jobId}/video_${Date.now()}.mp4`;
    //     const videoBuffer = fs.readFileSync(finalOutputPath);
    //     await uploadToS3(videoBuffer, tempVideoKey);
    //     const videoUrl = await s3Service.getPresignedUrl(tempVideoKey, 1800);

    //     // Extract audio from original video
    //     const originalVideoPath = path.join(outDir, `original_for_audio_${Date.now()}.mp4`);
    //     await s3Service.downloadFile(job.originalVideoS3Key, originalVideoPath);
    //     const audioPath = path.join(outDir, `original_audio_${Date.now()}.wav`);
    //     await extractAudio(originalVideoPath, audioPath);

    //     // Upload audio to get a URL
    //     const tempAudioKey = `temp-sync/${jobId}/audio_${Date.now()}.wav`;
    //     const audioBuffer = fs.readFileSync(audioPath);
    //     await uploadToS3(audioBuffer, tempAudioKey);
    //     const audioUrl = await s3Service.getPresignedUrl(tempAudioKey, 1800);

    //     console.log(`[gpu-worker] Calling sync.so API...`);
    //     await updateProgress(jobId, job.teamId, 90, "Processing lip sync");

    //     const syncedVideoUrl = await syncService.applyLipSync(videoUrl, audioUrl, {
    //       onProgress: (status) => {
    //         console.log(`[gpu-worker] Sync status: ${status}`);
    //       },
    //     });

    //     // Download synced video and replace final output
    //     const syncedBuffer = await syncService.downloadOutput(syncedVideoUrl);
    //     const syncedPath = path.join(outDir, `synced_final_${Date.now()}.mp4`);
    //     fs.writeFileSync(syncedPath, syncedBuffer);
    //     finalOutputPath = syncedPath;
    //     console.log(`[gpu-worker] Lip sync applied successfully`);

    //     // Cleanup temp S3 files
    //     try {
    //       await s3Service.deleteObject(tempVideoKey);
    //       await s3Service.deleteObject(tempAudioKey);
    //     } catch (cleanupErr) {
    //       console.warn(`[gpu-worker] Failed to cleanup temp sync files:`, cleanupErr);
    //     }
    //   } catch (syncErr) {
    //     console.error(`[gpu-worker] Lip sync failed, continuing without:`, (syncErr as Error).message);
    //     // Continue without lip sync - don't fail the whole job
    //   }
    // }

    // Step 11: Upload final video to S3
    console.log(`[gpu-worker] Uploading final video to S3...`);
    await updateProgress(jobId, job.teamId, 95, "Uploading final video");

    const finalBuffer = fs.readFileSync(finalOutputPath);
    const s3Key = `comfy-outputs/${job.teamId}/${jobId}/final.mp4`;
    const outputS3Key = await uploadToS3(finalBuffer, s3Key);

    // Step 11: Complete job and post-processing
    const outputUrl = await s3Service.getPresignedUrl(outputS3Key, 3600);
    await completeJob(jobId, job.teamId, true, outputS3Key, outputUrl);

    console.log(`[gpu-worker] Job ${jobId} completed successfully!`);

    // Step 12: Create clip record and send notifications
    try {
      const [member] = await db
        .select({ userId: teamMembers.user_id })
        .from(teamMembers)
        .where(eq(teamMembers.team_id, job.teamId))
        .limit(1);

      if (member) {
        const clipMetadata: Record<string, unknown> = {
          type: "face-swap",
          comfyJobId: jobId,
        };
        if (job.spliceSegmentS3Keys && job.spliceSegmentS3Keys.length > 0) {
          clipMetadata.spliceSegments = job.spliceSegmentS3Keys;
        }

        const [clip] = await db
          .insert(clips)
          .values({
            team_id: job.teamId,
            generated_by_user_id: member.userId,
            clip_path: outputS3Key,
            blank_video_path: outputS3Key,
            source_video_path: job.chunkS3Keys[0],
            status: "completed",
            saved: true,
            clip_metadata: clipMetadata,
            title: "UGC Face Swap",
          })
          .returning();
        console.log(`[gpu-worker] Created clip ${clip.id} in library`);

        // Transcribe and add captions
        try {
          const tempDir = path.join(
            process.cwd(),
            "output",
            `transcribe-${Date.now()}`
          );
          fs.mkdirSync(tempDir, { recursive: true });
          const tempVideoPath = path.join(tempDir, "video.mp4");

          await s3Service.downloadFile(outputS3Key, tempVideoPath);
          const transcriptionData = await transcribeVideoService(tempVideoPath);
          const words =
            transcriptionData.results.channels[0].alternatives[0].words;
          const captionsData = convertWordsToCaptionEntries(words);
          const srtContent = generateSrtFromCaptions(captionsData);
          const srtPath = path.join(tempDir, `captions_${clip.id}.srt`);
          fs.writeFileSync(srtPath, srtContent);
          const srtS3Key = await s3Service.uploadSrtFile(
            srtPath,
            job.teamId,
            clip.id
          );

          await db
            .update(clips)
            .set({
              captions_data: captionsData,
              srt_path: srtS3Key,
            })
            .where(eq(clips.id, clip.id));

          fs.rmSync(tempDir, { recursive: true, force: true });
          console.log(`[gpu-worker] Added captions to clip ${clip.id}`);
        } catch (transcribeErr) {
          console.error(
            `[gpu-worker] Transcription failed:`,
            (transcribeErr as Error).message
          );
        }

        // Send email notification
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, member.userId))
          .limit(1);

        if (user) {
          const frontendUrl =
            process.env.FRONTEND_URL || "https://platform.cuttr.com";
          await emailNotiService.sendClipsReady(user.email, {
            userName: user.first_name || "there",
            clipCount: 1,
            sourceFileName: "UGC Face Swap",
            clipsUrl: `${frontendUrl}/dashboard/ugc-studio`,
          });
          console.log(`[gpu-worker] Sent email notification to ${user.email}`);
        }
      }
    } catch (clipErr) {
      console.error(
        `[gpu-worker] Failed to create clip or notify:`,
        (clipErr as Error).message
      );
    }
  } catch (err) {
    console.error(`[gpu-worker] Job failed:`, (err as Error).message);

    if (jobId) {
      await completeJob(
        jobId,
        job.teamId,
        false,
        undefined,
        undefined,
        (err as Error).message
      );

      // Refund credits on failure (5 credits charged upfront in controller)
      try {
        await teamService.decrementTeamUsage(job.teamId, 5);
        console.log(
          `[gpu-worker] Refunded 5 credits to team ${job.teamId} due to job failure`
        );
      } catch (refundErr) {
        console.error(`[gpu-worker] Failed to refund credits:`, refundErr);
      }
    }

    throw err; // Re-throw so SQS knows the job failed
  } finally {
    // Cleanup local files
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
      console.log(`[gpu-worker] Cleaned up temp directory: ${outDir}`);
    }
  }
}
