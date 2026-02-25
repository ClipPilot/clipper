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
  onSyncComplete: (update: ViralitySyncUpdate) => void;
}

/**
 * Listens for virality-sync-update socket events for specific account IDs.
 * Calls onSyncComplete when a tracked account finishes syncing.
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
}
