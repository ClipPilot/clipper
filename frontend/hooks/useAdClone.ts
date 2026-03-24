"use client";

import { useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "@/lib/socket";
import type { AdCloneProjectStatus } from "@/store/adClone";

interface AdCloneSocketUpdate {
  projectId: string;
  status: AdCloneProjectStatus;
  progress: number;
  progressMessage: string;
  analysis?: any;
  scripts?: any[];
  clipId?: number | null;
  error?: string;
}

export function useAdCloneSocket(
  teamId: number | undefined,
  projectId: string | null,
  onUpdate: (update: AdCloneSocketUpdate) => void
) {
  const socketRef = useRef<Socket | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!teamId || !projectId) return;

    const socketUrl = getSocketUrl();
    socketRef.current = io(socketUrl, {
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      socketRef.current?.emit("join-team", teamId);
    });

    socketRef.current.on("ad-clone-job-update", (update: AdCloneSocketUpdate) => {
      if (update.projectId === projectId) {
        onUpdateRef.current(update);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-team", teamId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [teamId, projectId]);

  return {
    isConnected: socketRef.current?.connected ?? false,
  };
}
