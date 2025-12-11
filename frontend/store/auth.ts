"use client";

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Using atomWithStorage to persist auth state
export const userAtom = atomWithStorage<User | null>("user", null);

export const isAuthenticatedAtom = atom<boolean>((get) => {
  const user = get(userAtom);
  return user !== null;
});

export const isLoadingAtom = atom<boolean>(false);

export const authStateAtom = atom<AuthState>((get) => ({
  user: get(userAtom),
  isAuthenticated: get(isAuthenticatedAtom),
  isLoading: get(isLoadingAtom),
}));

export const selectedWorkspaceAtom = atomWithStorage<string>("selectedWorkspace", "personal");

