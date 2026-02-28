import { useEffect, useRef } from "react";
import { connectSocket } from "@/lib/socket";

interface ViralitySyncUpdate {
  accountId: number;
  syncStatus: "completed" | "failed";
  syncError?: string;
}

interface UseViralitySyncSocketOptions {
  teamId: number | undefined;
  accountIds: number[];
  onSyncComplete: (update?: ViralitySyncUpdate) => void;
}

const POLL_INTERVAL_MS = 5_000;

/**
 * Listens for virality-sync-update socket events for specific account IDs.
 * Calls onSyncComplete when a tracked account finishes syncing.
 * Also polls as a fallback in case the socket event is missed (race condition
 * when sync completes before the listener is attached).
 */
export function useViralitySyncSocket({
  teamId,
  accountIds,
  onSyncComplete,
}: UseViralitySyncSocketOptions) {
  const onSyncCompleteRef = useRef(onSyncComplete);
  const accountIdsRef = useRef(accountIds);

  useEffect(() => {
    onSyncCompleteRef.current = onSyncComplete;
  }, [onSyncComplete]);

  useEffect(() => {
    accountIdsRef.current = accountIds;
  }, [accountIds]);

  // Socket listener — fast path
  useEffect(() => {
    if (!teamId || accountIds.length === 0) return;

    const socket = connectSocket();

    const handler = (update: ViralitySyncUpdate) => {
      if (accountIdsRef.current.includes(update.accountId)) {
        onSyncCompleteRef.current(update);
      }
    };

    socket.on("virality-sync-update", handler);

    return () => {
      socket.off("virality-sync-update", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, accountIds.length]);

  // Polling fallback — catches missed socket events by re-fetching data
  useEffect(() => {
    if (!teamId || accountIds.length === 0) return;

    const interval = setInterval(() => {
      if (accountIdsRef.current.length > 0) {
        onSyncCompleteRef.current();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, accountIds.length]);
}
