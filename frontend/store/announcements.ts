"use client";

import { atom } from "jotai";

export interface Announcement {
  id: number;
  title: string;
  content: string; // HTML string
  priority: "info" | "warning" | "critical";
  icon?: string;
  action_label?: string;
  action_url?: string;
  published_at: string;
  is_read?: boolean; // Only present when fetching all announcements
}

// Unread announcements count (for badge)
export const unreadAnnouncementsAtom = atom<Announcement[]>([]);

// All announcements (for inbox display - includes read & unread)
export const allAnnouncementsAtom = atom<Announcement[]>([]);

// Inbox modal open state
export const isAnnouncementInboxOpenAtom = atom(false);

// Loading state
export const isLoadingAnnouncementsAtom = atom(false);

// Derived atom for unread count
export const unreadCountAtom = atom<number>((get) => {
  const unread = get(unreadAnnouncementsAtom);
  return unread.length;
});
