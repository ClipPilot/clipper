"use client";

import { atom } from "jotai";
import { ApplicationStatus } from "@/api/intake";

export const massPostingStatusAtom = atom<ApplicationStatus | null>(null);
export const massPostingLoadingAtom = atom<boolean>(true);
