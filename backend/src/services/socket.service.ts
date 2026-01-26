import * as Sentry from "@sentry/node";
import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";

let io: SocketServer | null = null;

export const initializeSocket = async (httpServer: HttpServer) => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Set up Redis adapter if REDIS_URL is configured
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const pubClient = new Redis(redisUrl);
      const subClient = pubClient.duplicate();

      await Promise.all([
        new Promise<void>((resolve) => pubClient.once("connect", resolve)),
        new Promise<void>((resolve) => subClient.once("connect", resolve)),
      ]);

      io.adapter(createAdapter(pubClient, subClient));
      console.log("Socket.io Redis adapter connected successfully");
    } catch (error) {
      console.error("Failed to connect Socket.io Redis adapter:", error);
      Sentry.captureException(error);
      console.log("Falling back to in-memory adapter");
    }
  } else {
    console.log("REDIS_URL not set, using in-memory Socket.io adapter");
  }

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("join-team", (teamId: number) => {
      socket.join(`team-${teamId}`);
      console.log(`Socket ${socket.id} joined team-${teamId}`);
    });

    socket.on("leave-team", (teamId: number) => {
      socket.leave(`team-${teamId}`);
      console.log(`Socket ${socket.id} left team-${teamId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

export const emitClipUpdate = (teamId: number, clip: any) => {
  if (io) {
    io.to(`team-${teamId}`).emit("clip-updated", clip);
  }
};

export const emitClipsRefresh = (teamId: number) => {
  if (io) {
    io.to(`team-${teamId}`).emit("clips-refresh");
  }
};

export interface ComfyJobUpdate {
  id: string;
  status: "pending_upload" | "queued" | "running" | "completed" | "failed" | "deleted";
  progress: number | null;
  progressMessage: string | null;
  outputUrl: string | null;
  errorMessage: string | null;
  createdAt?: string;
  finishedAt: string | null;
}

export const emitComfyJobUpdate = (teamId: number, job: ComfyJobUpdate) => {
  if (io) {
    io.to(`team-${teamId}`).emit("comfy-job-update", job);
  }
};

export interface ScriptJobUpdate {
  scriptId: string;
  status: "queued" | "generating" | "completed" | "failed";
  progress: number;
  progressMessage: string;
  scripts?: any[];
  selectedVariantIndex?: number;
  error?: string;
}

export const emitScriptJobUpdate = (teamId: number, update: ScriptJobUpdate) => {
  if (io) {
    io.to(`team-${teamId}`).emit("script-job-update", update);
  }
};

export interface UGCVideoJobUpdate {
  jobId: string;
  status: "queued" | "generating" | "completed" | "failed";
  progress: number;
  progressMessage: string;
  currentScene?: number;
  totalScenes?: number;
  finalVideoUrl?: string;
  finalVideoKey?: string;
  totalDurationSeconds?: number;
  sceneVideos?: Array<{
    sceneId: string;
    sceneNumber: number;
    audioKey: string;
    videoKey: string;
  }>;
  error?: string;
}

export const emitUGCVideoJobUpdate = (teamId: number, update: UGCVideoJobUpdate) => {
  if (io) {
    io.to(`team-${teamId}`).emit("ugc-video-job-update", update);
    console.log(`[SOCKET] Emitted ugc-video-job-update to team-${teamId}:`, update.jobId, update.status, update.progress);
  }
};

export interface AdCloneJobUpdate {
  projectId: string;
  status: string;
  progress: number;
  progressMessage: string;
  analysis?: any;
  scripts?: any[];
  error?: string;
}

export const emitAdCloneJobUpdate = (teamId: number, update: AdCloneJobUpdate) => {
  if (io) {
    io.to(`team-${teamId}`).emit("ad-clone-job-update", update);
    console.log(`[SOCKET] Emitted ad-clone-job-update to team-${teamId}:`, update.projectId, update.status, update.progress);
  }
};
