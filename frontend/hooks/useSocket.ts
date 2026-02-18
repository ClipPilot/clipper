import { useEffect, useRef } from "react";
import { connectSocket, joinTeam, leaveTeam } from "@/lib/socket";

const POLLING_INTERVAL = 30000;

export const useSocket = (teamId: number | undefined, onClipsRefresh: () => void) => {
  const lastRefreshRef = useRef<number>(Date.now());
  const callbackRef = useRef(onClipsRefresh);
  callbackRef.current = onClipsRefresh;

  // Connect socket and listen for clip events
  useEffect(() => {
    if (!teamId) return;

    const socket = connectSocket();
    joinTeam(teamId);

    const handleClipsRefresh = () => {
      lastRefreshRef.current = Date.now();
      callbackRef.current();
    };

    socket.on("clips-refresh", handleClipsRefresh);

    return () => {
      socket.off("clips-refresh", handleClipsRefresh);
      leaveTeam(teamId);
    };
  }, [teamId]);

  // Polling fallback for when WebSocket misses events
  useEffect(() => {
    if (!teamId) return;

    const interval = setInterval(() => {
      const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
      if (timeSinceLastRefresh > POLLING_INTERVAL * 2) {
        callbackRef.current();
        lastRefreshRef.current = Date.now();
      }
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [teamId]);
};
