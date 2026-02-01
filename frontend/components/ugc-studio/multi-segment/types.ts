"use client";

export interface VideoSegment {
  id: string;
  start: number;
  end: number;
}

export interface SegmentColor {
  border: string;
  bg: string;
  handle: string;
}

export const SEGMENT_COLORS: SegmentColor[] = [
  { border: "border-accent-400", bg: "bg-accent-400", handle: "bg-accent-400" },
  { border: "border-purple-500", bg: "bg-purple-500", handle: "bg-purple-500" },
  { border: "border-green-500", bg: "bg-green-500", handle: "bg-green-500" },
  { border: "border-yellow-500", bg: "bg-yellow-500", handle: "bg-yellow-500" },
  { border: "border-pink-500", bg: "bg-pink-500", handle: "bg-pink-500" },
];

export const FRAME_RATE = 30;
export const FRAME_DURATION = 1 / FRAME_RATE;

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

export function formatTimeWithFrames(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.round((seconds % 1) * FRAME_RATE);
  return `${mins}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}f`;
}

export function getSegmentColor(index: number): SegmentColor {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
}
