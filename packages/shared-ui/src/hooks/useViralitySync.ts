"use client";

import { useEffect, useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  syncingAccountsAtom,
  activeSyncingIdsAtom,
  type SyncAccountStatus,
} from "../lib/viralitySync";

interface ViralitySyncUpdate {
  accountId: number;
  syncStatus: SyncAccountStatus;
  syncError?: string;
}

export interface SocketConnector {
  connect(): { on(event: string, handler: (data: any) => void): void; off(event: string, handler: (data: any) => void): void };
  joinTeam(teamId: number): void;
  leaveTeam(teamId: number): void;
}

export function useViralitySyncSocketGlobal(
  teamId: number | undefined,
  socketConnector: SocketConnector,
) {
  const [, setSyncingAccounts] = useAtom(syncingAccountsAtom);

  useEffect(() => {
    if (!teamId) return;

    const socket = socketConnector.connect();
    socketConnector.joinTeam(teamId);

    const handler = (update: ViralitySyncUpdate) => {
      setSyncingAccounts((prev) => {
        if (update.syncStatus === "syncing" || prev[update.accountId]) {
          const next = { ...prev };
          if (update.syncStatus === "completed" || update.syncStatus === "failed") {
            delete next[update.accountId];
          } else {
            next[update.accountId] = {
              accountId: update.accountId,
              status: update.syncStatus,
              error: update.syncError,
              startedAt: prev[update.accountId]?.startedAt ?? Date.now(),
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
      socketConnector.leaveTeam(teamId);
    };
  }, [teamId, setSyncingAccounts, socketConnector]);
}

export function useViralitySync() {
  const [syncingAccounts, setSyncingAccounts] = useAtom(syncingAccountsAtom);
  const activeSyncingIds = useAtomValue(activeSyncingIdsAtom);

  const startSync = useCallback(
    (accountIds: number[]) => {
      setSyncingAccounts((prev) => {
        const next = { ...prev };
        for (const id of accountIds) {
          next[id] = { accountId: id, status: "syncing", startedAt: Date.now() };
        }
        return next;
      });
    },
    [setSyncingAccounts]
  );

  const isAnySyncing = useCallback(
    (accountIds: number[]) => {
      return accountIds.some((id) => syncingAccounts[id]?.status === "syncing");
    },
    [syncingAccounts]
  );

  const getSyncingIds = useCallback(
    (accountIds: number[]) => {
      return accountIds.filter((id) => syncingAccounts[id]?.status === "syncing");
    },
    [syncingAccounts]
  );

  const reconcileSync = useCallback(
    (accounts: { id: number; sync_status: string }[]) => {
      setSyncingAccounts((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const acct of accounts) {
          if (next[acct.id] && acct.sync_status !== "syncing") {
            delete next[acct.id];
            changed = true;
          } else if (!next[acct.id] && acct.sync_status === "syncing") {
            next[acct.id] = { accountId: acct.id, status: "syncing", startedAt: Date.now() };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    [setSyncingAccounts]
  );

  return {
    syncingAccounts,
    activeSyncingIds,
    startSync,
    isAnySyncing,
    getSyncingIds,
    reconcileSync,
  };
}
