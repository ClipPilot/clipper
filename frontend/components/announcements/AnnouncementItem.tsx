"use client";

import React from "react";
import { Card, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Announcement } from "@/store/announcements";

interface AnnouncementItemProps {
  announcement: Announcement;
  onDismiss: (id: number) => void;
}

export default function AnnouncementItem({ announcement, onDismiss }: AnnouncementItemProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-gradient-to-br from-danger-500 to-danger-600 text-white shadow-lg shadow-danger-500/50";
      case "warning":
        return "bg-gradient-to-br from-warning-500 to-warning-600 text-white shadow-lg shadow-warning-500/50";
      case "info":
      default:
        return "bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/50";
    }
  };

  const getPriorityBorderColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "border-l-danger-500";
      case "warning":
        return "border-l-warning-500";
      case "info":
      default:
        return "border-l-primary-500";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "critical":
        return "solar:danger-circle-bold-duotone";
      case "warning":
        return "solar:info-circle-bold-duotone";
      case "info":
      default:
        return "solar:bell-bold-duotone";
    }
  };

  const isRead = announcement.is_read;

  return (
    <Card
 className={`
 border border-border-base border-l-4 ${getPriorityBorderColor(announcement.priority)}
 shadow-md hover:shadow-xl transition-all duration-300
 ${isRead ? "opacity-50 hover:opacity-70" : "hover:scale-[1.02]"}
 bg-gradient-to-br from-surface-base to-surface-elevated
 `}
 >
      <Card.Content className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Icon and Content */}
          <div className="flex gap-4 flex-1">
            {/* Priority Icon */}
            <div className={`p-3 rounded-xl ${getPriorityColor(announcement.priority)} flex-shrink-0`}>
              <Icon
                icon={announcement.icon || getPriorityIcon(announcement.priority)}
                width={28}
              />
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-text-primary font-bold text-lg">
                  {announcement.title}
                </h3>
                {!isRead && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                  </span>
                )}
                {isRead && (
                  <span className="text-xs text-text-tertiary bg-surface-lighter px-3 py-1 rounded-full font-medium border border-border-base">
                    Read
                  </span>
                )}
              </div>
              <div
                className="text-text-secondary text-sm announcement-content leading-relaxed mb-3"
                dangerouslySetInnerHTML={{ __html: announcement.content }}
              />
              {announcement.action_url && (
                <Button variant="primary"
 size="md"
 className="mt-4 font-semibold shadow-lg"
 onPress={() => window.open(announcement.action_url, "_blank")}
 >
                  {announcement.action_label || "Learn More"}
                  <Icon icon="solar:arrow-right-up-linear" width={18} />
</Button>
              )}
              <div className="flex items-center gap-2 mt-4 text-xs text-text-tertiary">
                <Icon icon="solar:clock-circle-bold-duotone" width={14} />
                <span>
                  {new Date(announcement.published_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Dismiss Button */}
          {!isRead && (
            <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 onPress={() => onDismiss(announcement.id)}
 aria-label="Dismiss announcement"
 className="flex-shrink-0 hover:bg-danger-100 dark:hover:bg-danger-900/20 transition-colors"
 >
              <Icon icon="solar:close-circle-bold-duotone" width={22} className="text-text-tertiary hover:text-red-500" />
            </Button>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}
