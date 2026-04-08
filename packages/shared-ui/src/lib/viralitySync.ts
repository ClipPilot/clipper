"use client";

import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

export type SyncAccountStatus = "syncing" | "completed" | "failed";

export interface SyncAccountState {
  accountId: number;
  status: SyncAccountStatus;
  error?: string;
  startedAt: number;
}

const SYNC_TTL_MS = 10 * 60 * 1000;

const sessionJSONStorage = createJSONStorage<Record<number, SyncAccountState>>(
  () => sessionStorage,
);

const rawSyncingAccountsAtom = atomWithStorage<Record<number, SyncAccountState>>(
  "virality-syncing-accounts",
  {},
  sessionJSONStorage,
);

function pruneExpired(map: Record<number, SyncAccountState> | null | undefined): Record<number, SyncAccountState> {
  if (!map || typeof map !== "object") return {};
  const now = Date.now();
  let changed = false;
  const pruned: Record<number, SyncAccountState> = {};
  for (const [key, entry] of Object.entries(map)) {
    if (now - entry.startedAt < SYNC_TTL_MS) {
      pruned[Number(key)] = entry;
    } else {
      changed = true;
    }
  }
  return changed ? pruned : map;
}

export const syncingAccountsAtom = atom(
  (get) => pruneExpired(get(rawSyncingAccountsAtom)),
  (_get, set, update: Record<number, SyncAccountState> | ((prev: Record<number, SyncAccountState>) => Record<number, SyncAccountState>)) => {
    set(rawSyncingAccountsAtom, (prev) => {
      const pruned = pruneExpired(prev);
      const next = typeof update === "function" ? update(pruned) : update;
      return next;
    });
  }
);

export const activeSyncingIdsAtom = atom<number[]>((get) => {
  const map = get(syncingAccountsAtom);
  return Object.values(map)
    .filter((s) => s.status === "syncing")
    .map((s) => s.accountId);
});

export const isSyncInProgressAtom = atom<boolean>((get) => {
  return get(activeSyncingIdsAtom).length > 0;
});
