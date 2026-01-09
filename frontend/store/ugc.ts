"use client";

import { atom } from "jotai";
import type { Voice } from "@/config/voicesConfig";
import type { UGCScript } from "@/components/ugc-studio/script/types";

export const selectedVoiceAtom = atom<Voice | null>(null);

export const scriptIdAtom = atom<string | null>(null);
export const scriptsAtom = atom<UGCScript[]>([]);
export const selectedVariantIndexAtom = atom(0);
