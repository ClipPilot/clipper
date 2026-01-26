"use client";

import React, { useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import AnnouncementItem from "./AnnouncementItem";

export default function AnnouncementInboxModal() {
  const {
    isOpen,
    setIsOpen,
    allAnnouncements,
    unreadCount,
    dismiss,
    dismissAll,
    isLoading,
    fetchAll,
  } = useAnnouncements();

  // Fetch all announcements when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAll();
    }
  }, [isOpen, fetchAll]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-surface-dark",
        header: "border-b border-border-base",
        body: "p-0",
      }}
    >
      <ModalContent>
        {/* Header */}
        <ModalHeader className="flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-2">
            <Icon icon="solar:bell-bold-duotone" width={24} className="text-primary-500" />
            <span className="text-lg font-semibold">Announcements</span>
            {unreadCount > 0 && (
              <span className="text-sm text-primary-500">({unreadCount} new)</span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="light"
              onPress={dismissAll}
              startContent={<Icon icon="solar:check-read-linear" width={18} />}
            >
              Mark all as read
            </Button>
          )}
        </ModalHeader>

        {/* Body */}
        <ModalBody className="max-h-[500px]">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Spinner size="lg" />
            </div>
          ) : allAnnouncements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <div className="p-4 bg-surface-light dark:bg-surface-lighter rounded-full mb-4">
                <Icon
                  icon="solar:bell-off-bold-duotone"
                  width={48}
                  className="text-text-tertiary"
                />
              </div>
              <h3 className="text-text-primary font-medium mb-1">
                No announcements yet
              </h3>
              <p className="text-text-secondary text-sm text-center">
                New announcements will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {allAnnouncements.map((announcement) => (
                <AnnouncementItem
                  key={announcement.id}
                  announcement={announcement}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
