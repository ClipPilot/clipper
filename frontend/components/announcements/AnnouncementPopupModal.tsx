"use client";

import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { Announcement } from "@/store/announcements";

export default function AnnouncementPopupModal() {
  const { unread, dismiss } = useAnnouncements();
  const [isOpen, setIsOpen] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [shownAnnouncementIds, setShownAnnouncementIds] = useState<Set<number>>(new Set());

  // Show popup for latest unread announcement (only once per announcement)
  useEffect(() => {
    if (unread.length > 0) {
      const latestUnread = unread[0];
      // Only show if we haven't shown this announcement yet
      if (!shownAnnouncementIds.has(latestUnread.id)) {
        setCurrentAnnouncement(latestUnread);
        setIsOpen(true);
        setShownAnnouncementIds(prev => new Set(prev).add(latestUnread.id));
      }
    }
  }, [unread, shownAnnouncementIds]);

  const handleDismiss = () => {
    if (currentAnnouncement) {
      dismiss(currentAnnouncement.id);
    }
    setIsOpen(false);
  };

  const handleViewAll = () => {
    setIsOpen(false);
    // The main inbox modal will be opened by the bell button
  };

  if (!currentAnnouncement) return null;

  const getPriorityGradient = (priority: string) => {
    switch (priority) {
      case "critical":
        return "from-danger-500 via-danger-600 to-danger-700";
      case "warning":
        return "from-warning-500 via-warning-600 to-warning-700";
      case "info":
      default:
        return "from-primary-500 via-primary-600 to-primary-700";
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
        return "solar:bell-bing-bold-duotone";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "critical":
        return "Critical Update";
      case "warning":
        return "Important Notice";
      case "info":
      default:
        return "New Announcement";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      size="3xl"
      backdrop="blur"
      classNames={{
        backdrop: "bg-black/80 backdrop-blur-md",
        base: "border border-border-light shadow-2xl",
        closeButton: "hover:bg-white/10 text-white",
      }}
      motionProps={{
        variants: {
          enter: {
            scale: 1,
            opacity: 1,
            transition: {
              duration: 0.4,
              ease: "easeOut",
            },
          },
          exit: {
            scale: 0.9,
            opacity: 0,
            transition: {
              duration: 0.2,
              ease: "easeIn",
            },
          },
        },
      }}
    >
      <ModalContent className="overflow-hidden">
        {/* Gradient Header */}
        <div className={`bg-gradient-to-br ${getPriorityGradient(currentAnnouncement.priority)} p-8 relative overflow-hidden`}>
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          </div>

          {/* Header content */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Icon
                  icon={currentAnnouncement.icon || getPriorityIcon(currentAnnouncement.priority)}
                  width={32}
                  className="text-white"
                />
              </div>
              <div>
                <p className="text-white/80 text-sm font-semibold uppercase tracking-wider">
                  {getPriorityLabel(currentAnnouncement.priority)}
                </p>
                <h2 className="text-white text-2xl font-bold mt-1">
                  {currentAnnouncement.title}
                </h2>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <ModalBody className="p-8 bg-surface-base">
          <div
            className="text-text-primary text-base announcement-content leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: currentAnnouncement.content }}
          />

          {currentAnnouncement.action_url && (
            <Button
              size="lg"
              color="primary"
              className="mt-6 w-full font-bold shadow-lg text-base"
              onPress={() => window.open(currentAnnouncement.action_url, "_blank")}
              endContent={<Icon icon="solar:arrow-right-up-linear" width={20} />}
            >
              {currentAnnouncement.action_label || "Learn More"}
            </Button>
          )}

          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-text-tertiary">
            <Icon icon="solar:clock-circle-bold-duotone" width={16} />
            <span>
              {new Date(currentAnnouncement.published_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        </ModalBody>

        {/* Footer */}
        <ModalFooter className="bg-surface-elevated border-t border-border-base p-6">
          <Button
            variant="light"
            onPress={handleDismiss}
            className="font-semibold"
            startContent={<Icon icon="solar:check-circle-bold-duotone" width={20} />}
          >
            Mark as Read
          </Button>
          {unread.length > 1 && (
            <Button
              color="primary"
              variant="flat"
              onPress={handleViewAll}
              className="font-semibold"
              endContent={<Icon icon="solar:inbox-line-bold-duotone" width={20} />}
            >
              View All ({unread.length})
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
