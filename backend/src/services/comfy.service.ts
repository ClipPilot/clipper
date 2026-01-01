import crypto from "crypto";
import path from "path";
import "multer";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { db } from "../db";
import { comfyJobs } from "@clipper/shared-db/src/schema";
import { eq, sql } from "drizzle-orm";

// GPU config for file uploads - uses first GPU in the list
// Worker will use its own config for job execution
const COMFY_BASE_URL =
  process.env.COMFY_BASE_URL ||
  "https://d7extz01utcetv-8188.proxy.runpod.net";

class ComfyService {
  private async uploadToComfy(file: Express.Multer.File) {
    const form = new FormData();

    const ext = path.extname(file.originalname);
    const filename = `${crypto.randomUUID()}${ext}`;

    const blob = new Blob([file.buffer], { type: file.mimetype });
    form.append("image", blob, filename);
    form.append("type", "input");

    const res = await fetchWithTimeout(
      `${COMFY_BASE_URL}/upload/image`,
      {
        method: "POST",
        body: form,
      },
      60_000
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ComfyUI upload failed: ${text}`);
    }

    const data = (await res.json()) as { name: string };

    return data.name;
  }

  async uploadInputs(params: {
    image: Express.Multer.File;
    video: Express.Multer.File;
  }) {
    const [imageName, videoName] = await Promise.all([
      this.uploadToComfy(params.image),
      this.uploadToComfy(params.video),
    ]);

    return {
      image: imageName,
      video: videoName,
    };
  }

  async createJob(params: {
    teamId: number;
    imageFile: string;
    videoFile: string;
  }) {
    const [job] = await db
      .insert(comfyJobs)
      .values({
        teamId: params.teamId,
        imageFile: params.imageFile,
        videoFile: params.videoFile,
        status: "queued",
        progress: 0,
      })
      .returning();

    return job;
  }

  async getJob(jobId: string) {
    const [job] = await db
      .select()
      .from(comfyJobs)
      .where(eq(comfyJobs.id, jobId))
      .limit(1);

    return job || null;
  }

  async assignNextJob(podId: string) {
    return await db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        SELECT * FROM comfy_jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      const job = result.rows[0] as typeof comfyJobs.$inferSelect | undefined;
      if (!job) return null;

      const [updatedJob] = await tx
        .update(comfyJobs)
        .set({
          status: "running",
          assignedPod: podId,
          startedAt: new Date(),
        })
        .where(eq(comfyJobs.id, job.id))
        .returning();

      return updatedJob;
    });
  }

  async updateProgress(jobId: string, progress: number, message?: string) {
    const [updatedJob] = await db
      .update(comfyJobs)
      .set({
        progress,
        progressMessage: message || null,
      })
      .where(eq(comfyJobs.id, jobId))
      .returning();

    return updatedJob || null;
  }

  async completeJob(
    jobId: string,
    success: boolean,
    outputFile?: string,
    errorMessage?: string
  ) {
    const [updatedJob] = await db
      .update(comfyJobs)
      .set({
        status: success ? "completed" : "failed",
        progress: success ? 100 : null,
        progressMessage: success ? "Completed" : errorMessage || null,
        outputFile: outputFile || null,
        errorMessage: errorMessage || null,
        finishedAt: new Date(),
      })
      .where(eq(comfyJobs.id, jobId))
      .returning();

    return updatedJob || null;
  }
}

export const comfyService = new ComfyService();
