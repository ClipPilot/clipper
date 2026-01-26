"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { io, Socket } from "socket.io-client";
import {
  unreadAnnouncementsAtom,
  allAnnouncementsAtom,
  isAnnouncementInboxOpenAtom,
  isLoadingAnnouncementsAtom,
  Announcement,
} from "@/store/announcements";
import { announcementsAPI } from "@/api/announcements";

const getSocketUrl = (): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return "http://localhost:3001";

  try {
    const url = new URL(apiUrl);
    return url.origin;
  } catch {
    return apiUrl.replace(/\/api\/?$/, "");
  }
};

const SOCKET_URL = getSocketUrl();

export function useAnnouncements() {
  const [unread, setUnread] = useAtom(unreadAnnouncementsAtom);
  const [allAnnouncements, setAllAnnouncements] = useAtom(allAnnouncementsAtom);
  const [isOpen, setIsOpen] = useAtom(isAnnouncementInboxOpenAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingAnnouncementsAtom);
  const socketRef = useRef<Socket | null>(null);

  // Fetch unread announcements (for badge count)
  const fetchUnread = useCallback(async () => {
    try {
      const announcements = await announcementsAPI.getUnreadAnnouncements();
      setUnread(announcements || []);
    } catch (error) {
      console.error("Failed to fetch unread announcements:", error);
      setUnread([]);
    }
  }, [setUnread]);

  // Fetch all announcements (for inbox display)
  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      const announcements = await announcementsAPI.getAllAnnouncements();
      setAllAnnouncements(announcements || []);
      // Also update unread count
      await fetchUnread();
    } catch (error) {
      console.error("Failed to fetch all announcements:", error);
      setAllAnnouncements([]);
    } finally {
      setIsLoading(false);
    }
  }, [setAllAnnouncements, setIsLoading, fetchUnread]);

  // Dismiss single announcement
  const dismiss = useCallback(
    async (id: number) => {
      try {
        await announcementsAPI.dismissAnnouncement(id);
        // Remove from unread
        setUnread((prev) => (prev || []).filter((a) => a.id !== id));
        // Mark as read in all announcements
        setAllAnnouncements((prev) =>
          (prev || []).map((a) => (a.id === id ? { ...a, is_read: true } : a))
        );
      } catch (error) {
        console.error("Failed to dismiss announcement:", error);
        // Re-fetch to ensure consistency
        fetchUnread();
        fetchAll();
      }
    },
    [setUnread, setAllAnnouncements, fetchUnread, fetchAll]
  );

  // Dismiss all announcements
  const dismissAll = useCallback(async () => {
    try {
      await announcementsAPI.dismissAllAnnouncements();
      setUnread([]);
      // Mark all as read
      setAllAnnouncements((prev) => (prev || []).map((a) => ({ ...a, is_read: true })));
    } catch (error) {
      console.error("Failed to dismiss all announcements:", error);
      // Re-fetch to ensure consistency
      fetchUnread();
      fetchAll();
    }
  }, [setUnread, setAllAnnouncements, fetchUnread, fetchAll]);

  // Socket listener for new announcements
  useEffect(() => {
    // Initialize socket connection
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
      });

      socketRef.current.on("new-announcement", (announcement: Announcement) => {
        // Add new announcement to the beginning of the list
        setUnread((prev) => [announcement, ...(prev || [])]);
      });
    }

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.off("new-announcement");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [setUnread]);

  return {
    unread: unread || [],
    allAnnouncements: allAnnouncements || [],
    unreadCount: unread?.length || 0,
    isOpen,
    setIsOpen,
    isLoading,
    dismiss,
    dismissAll,
    fetchUnread,
    fetchAll,
  };
}
