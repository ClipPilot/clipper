"use client";

import { atom } from "jotai";
import type { Campaign } from "@/api/campaign";

export const campaignsListAtom = atom<Campaign[]>([]);
export const selectedCampaignIdAtom = atom<number | null>(null);
export const campaignsLoadingAtom = atom<boolean>(false);
