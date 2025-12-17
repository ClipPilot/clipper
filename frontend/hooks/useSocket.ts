import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3001";
const POLLING_INTERVAL = 30000; // Poll every 30 seconds as fallback (Redis handles real-time)

export const useSocket = (teamId: number | undefined, onClipsRefresh: () => void) => {
  const socketRef = useRef<Socket | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRefreshRef = useRef<number>(Date.now());

  const connect = useCallback(() => {
    if (!teamId) return;

    if (socketRef.current?.connected) {
      return;
    }

    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected");
      socketRef.current?.emit("join-team", teamId);
    });

    socketRef.current.on("clips-refresh", () => {
      console.log("Received clips-refresh event");
      lastRefreshRef.current = Date.now();
      onClipsRefresh();
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  }, [teamId, onClipsRefresh]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (teamId) {
        socketRef.current.emit("leave-team", teamId);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [teamId]);

  // Polling fallback for when WebSocket doesn't work across load balancer instances
  useEffect(() => {
    if (!teamId) return;

    pollingRef.current = setInterval(() => {
      // Only poll if socket isn't connected or hasn't received events recently
      const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
      if (!socketRef.current?.connected || timeSinceLastRefresh > POLLING_INTERVAL * 2) {
        console.log("Polling for clip updates...");
        onClipsRefresh();
        lastRefreshRef.current = Date.now();
      }
    }, POLLING_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [teamId, onClipsRefresh]);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { socket: socketRef.current };
};
