import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { VideoGenerationStatus } from "@/api/ugc/video";

const getSocketUrl = (): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return "http://localhost:3001";

  try {
    const url = new URL(apiUrl);
    return url.origin;
  } catch {
    return apiUrl.replace(/\/api\/?$/, "");
  }
};

const SOCKET_URL = getSocketUrl();

interface UGCVideoSocketUpdate {
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

interface UseUGCVideoSocketOptions {
  teamId: number | undefined;
  jobId: string | null;
  onUpdate: (status: VideoGenerationStatus) => void;
}

/**
 * Hook to listen for real-time UGC video generation updates via WebSocket
 * Replaces polling with socket-based updates for better UX
 */
export function useUGCVideoSocket({ teamId, jobId, onUpdate }: UseUGCVideoSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep callback ref updated without causing reconnections
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const connect = useCallback(() => {
    if (!teamId || !jobId) return;

    // Already connected
    if (socketRef.current?.connected) {
      return;
    }

    console.log("[UGCVideoSocket] Connecting to", SOCKET_URL);
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      console.log("[UGCVideoSocket] Connected, joining team:", teamId);
      socketRef.current?.emit("join-team", teamId);
    });

    socketRef.current.on("ugc-video-job-update", (update: UGCVideoSocketUpdate) => {
      console.log("[UGCVideoSocket] Received update:", update.jobId, update.status, update.progress);

      // Only process updates for our job
      if (update.jobId === jobId) {
        onUpdateRef.current({
          jobId: update.jobId,
          status: update.status,
          progress: update.progress,
          progressMessage: update.progressMessage,
          currentScene: update.currentScene,
          totalScenes: update.totalScenes,
          finalVideoUrl: update.finalVideoUrl,
          finalVideoKey: update.finalVideoKey,
          totalDurationSeconds: update.totalDurationSeconds,
          sceneVideos: update.sceneVideos,
          error: update.error,
        });
      }
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("[UGCVideoSocket] Disconnected:", reason);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("[UGCVideoSocket] Connection error:", error.message);
    });
  }, [teamId, jobId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (teamId) {
        socketRef.current.emit("leave-team", teamId);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
      console.log("[UGCVideoSocket] Disconnected and cleaned up");
    }
  }, [teamId]);

  // Connect when we have teamId and jobId
  useEffect(() => {
    if (teamId && jobId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [teamId, jobId, connect, disconnect]);

  return {
    isConnected: socketRef.current?.connected ?? false,
  };
}
