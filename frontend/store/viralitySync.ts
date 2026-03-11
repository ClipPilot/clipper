"use client";

import { atom } from "jotai";

export type SyncAccountStatus = "syncing" | "completed" | "failed";

export interface SyncAccountState {
  accountId: number;
  status: SyncAccountStatus;
  error?: string;
}

/**
 * Global map of account IDs currently syncing (or recently finished).
 * Keyed by accountId. Persists across page navigation since Jotai atoms
 * live in the React tree root (provider).
 */
export const syncingAccountsAtom = atom<Record<number, SyncAccountState>>({});

/** Derived: list of account IDs that are actively syncing */
export const activeSyncingIdsAtom = atom<number[]>((get) => {
  const map = get(syncingAccountsAtom);
  return Object.values(map)
    .filter((s) => s.status === "syncing")
    .map((s) => s.accountId);
});

/** Check if any sync is in progress */
export const isSyncInProgressAtom = atom<boolean>((get) => {
  return get(activeSyncingIdsAtom).length > 0;
});
