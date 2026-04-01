"use client";

import React from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAnnouncements } from "@/hooks/useAnnouncements";

export default function NotificationBellButton() {
  const { unreadCount, setIsOpen } = useAnnouncements();

  return (
    <Button
 isIconOnly
 variant="tertiary"
 onPress={() => setIsOpen(true)}
 aria-label="Announcements"
 className="relative overflow-visible"
 >
      <Icon icon="solar:bell-bold-duotone" width={24} />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-danger ring-2 ring-surface-base"></span>
        </span>
      )}
    </Button>
  );
}
