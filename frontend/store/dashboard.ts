"use client";

import { atom } from "jotai";

export interface WidgetConfig {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_LAYOUT: WidgetConfig[] = [
  { i: "credits", x: 0, y: 0, w: 1, h: 1 },
  { i: "team", x: 1, y: 0, w: 1, h: 1 },
  { i: "quickActions", x: 2, y: 0, w: 1, h: 1 },
  { i: "library", x: 0, y: 1, w: 2, h: 2 },
  { i: "processing", x: 2, y: 1, w: 1, h: 2 },
];

export const WIDGET_COLOR_OPTIONS = [
  { name: "accent", value: "#4F47E6" },
  { name: "success", value: "#22C55E" },
  { name: "warning", value: "#F59E0B" },
  { name: "error", value: "#EF4444" },
  { name: "purple", value: "#A855F7" },
  { name: "pink", value: "#EC4899" },
  { name: "cyan", value: "#06B6D4" },
];

export const dashboardLayoutAtom = atom<WidgetConfig[]>(DEFAULT_LAYOUT);
export const widgetColorsAtom = atom<Record<string, string>>({});
export const preferencesLoadedAtom = atom<boolean>(false);
export const isEditModeAtom = atom<boolean>(false);
