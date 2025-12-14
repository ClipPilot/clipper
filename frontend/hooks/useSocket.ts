import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3001";

export const useSocket = (teamId: number | undefined, onClipsRefresh: () => void) => {
  const socketRef = useRef<Socket | null>(null);

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

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { socket: socketRef.current };
};
