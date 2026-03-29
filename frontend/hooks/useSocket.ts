import { useEffect, useRef } from "react";
import { connectSocket, joinTeam, leaveTeam } from "@/lib/socket";

const POLLING_INTERVAL = 30000;

export const useSocket = (
  teamId: number | undefined,
  onClipsRefresh: () => void,
  onClipUpdated?: (clipId: number) => void
) => {
  const lastRefreshRef = useRef<number>(Date.now());
  const callbackRef = useRef(onClipsRefresh);
  callbackRef.current = onClipsRefresh;
  const clipUpdatedRef = useRef(onClipUpdated);
  clipUpdatedRef.current = onClipUpdated;

  // Connect socket and listen for clip events
  useEffect(() => {
    if (!teamId) return;

    const socket = connectSocket();
    joinTeam(teamId);

    const handleClipsRefresh = () => {
      lastRefreshRef.current = Date.now();
      callbackRef.current();
    };

    const handleClipUpdated = (data: { id: number }) => {
      lastRefreshRef.current = Date.now();
      if (clipUpdatedRef.current && data?.id) {
        clipUpdatedRef.current(data.id);
      }
    };

    socket.on("clips-refresh", handleClipsRefresh);
    socket.on("clip-updated", handleClipUpdated);

    return () => {
      socket.off("clips-refresh", handleClipsRefresh);
      socket.off("clip-updated", handleClipUpdated);
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
