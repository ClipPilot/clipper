import { useEffect, useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import { connectSocket } from "@/lib/socket";
import {
  syncingAccountsAtom,
  activeSyncingIdsAtom,
  type SyncAccountStatus,
} from "@/store/viralitySync";

interface ViralitySyncUpdate {
  accountId: number;
  syncStatus: SyncAccountStatus;
  syncError?: string;
}

/**
 * Global socket listener that writes sync updates into the Jotai atom.
 * Mount this once near the app root (or in a layout) so it stays alive
 * across page navigations.
 */
export function useViralitySyncSocketGlobal(teamId: number | undefined) {
  const [, setSyncingAccounts] = useAtom(syncingAccountsAtom);

  useEffect(() => {
    if (!teamId) return;

    const socket = connectSocket();

    const handler = (update: ViralitySyncUpdate) => {
      setSyncingAccounts((prev) => {
        // Only update if we're tracking this account or it's a new "syncing" event
        if (update.syncStatus === "syncing" || prev[update.accountId]) {
          const next = { ...prev };
          if (update.syncStatus === "completed" || update.syncStatus === "failed") {
            // Remove from map — sync is done
            delete next[update.accountId];
          } else {
            next[update.accountId] = {
              accountId: update.accountId,
              status: update.syncStatus,
              error: update.syncError,
            };
          }
          return next;
        }
        return prev;
      });
    };

    socket.on("virality-sync-update", handler);

    return () => {
      socket.off("virality-sync-update", handler);
    };
  }, [teamId, setSyncingAccounts]);
}

/**
 * Hook for pages that trigger syncs. Returns helpers to:
 * - Start tracking account IDs as syncing
 * - Read which accounts are actively syncing
 * - Check if a specific set of accounts has any active syncs
 */
export function useViralitySync() {
  const [syncingAccounts, setSyncingAccounts] = useAtom(syncingAccountsAtom);
  const activeSyncingIds = useAtomValue(activeSyncingIdsAtom);

  /** Mark accounts as syncing (call after firing the HTTP request) */
  const startSync = useCallback(
    (accountIds: number[]) => {
      setSyncingAccounts((prev) => {
        const next = { ...prev };
        for (const id of accountIds) {
          next[id] = { accountId: id, status: "syncing" };
        }
        return next;
      });
    },
    [setSyncingAccounts]
  );

  /** Check if any of the given account IDs are currently syncing */
  const isAnySyncing = useCallback(
    (accountIds: number[]) => {
      return accountIds.some((id) => syncingAccounts[id]?.status === "syncing");
    },
    [syncingAccounts]
  );

  /** Get the syncing account IDs from a given set */
  const getSyncingIds = useCallback(
    (accountIds: number[]) => {
      return accountIds.filter((id) => syncingAccounts[id]?.status === "syncing");
    },
    [syncingAccounts]
  );

  return {
    syncingAccounts,
    activeSyncingIds,
    startSync,
    isAnySyncing,
    getSyncingIds,
  };
}
