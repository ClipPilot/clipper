"use client";

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { User } from "@clipper/shared-types";

export type { User };

export interface Team {
  id: number;
  name: string;
  type: "personal" | "business" | "enterprise";
  role: "owner" | "manager" | "member";
  plan: "free" | "creator" | "studio" | "scale" | "enterprise";
  teamSubscriptionId?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

const storageOptions = { getOnInit: false };

export const userTeamsAtom = atomWithStorage<Team[]>("userTeams", [], undefined, storageOptions);
export const selectedTeamAtom = atomWithStorage<Team | null>("selectedTeam", null, undefined, storageOptions);
export const defaultTeamIdAtom = atomWithStorage<number | null>("defaultTeamId", null, undefined, storageOptions);
