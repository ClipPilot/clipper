"use client";

import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { adPostingAPI } from "@/api/adPosting";

interface Clip {
  id: number;
  title?: string;
  clipUrl?: string;
}

interface AdPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: Clip;
}

const PLATFORMS = [
  { key: "tiktok", name: "TikTok", icon: "logos:tiktok-icon" },
  { key: "instagram", name: "Instagram", icon: "skill-icons:instagram" },
  { key: "facebook", name: "Facebook", icon: "logos:facebook" },
  { key: "youtube", name: "YouTube", icon: "logos:youtube-icon" },
  { key: "x", name: "X", icon: "ri:twitter-x-fill" },
] as const;

export default function AdPostingModal({
  isOpen,
  onClose,
  clip,
}: AdPostingModalProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set()
  );
  const [isPosting, setIsPosting] = useState(false);

  const togglePlatform = (key: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handlePost = async () => {
    if (!selectedTeam?.id || selectedPlatforms.size === 0) return;

    setIsPosting(true);
    try {
      await adPostingAPI.postToPlatforms(
        selectedTeam.id,
        clip.id,
        Array.from(selectedPlatforms)
      );

      const count = selectedPlatforms.size;
      addToast({
        title: "Ad posting started",
        description: `Processing ${count} platform${count > 1 ? "s" : ""} in the background...`,
        color: "primary",
      });

      setSelectedPlatforms(new Set());
      onClose();
    } catch (error: any) {
      addToast({
        title: "Posting failed",
        description: error.message || "Failed to start ad posting",
        color: "danger",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const creditCount = selectedPlatforms.size;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      classNames={{
        wrapper: "z-[9999] isolate",
        backdrop: "z-[9998]",
        base: "bg-surface-base border border-border-base z-[9999]",
        header: "border-b border-border-base",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon
            icon="mdi:megaphone"
            className="text-xl text-accent-400"
          />
          <span>Send to Ad Posting</span>
        </ModalHeader>

        <ModalBody className="py-4">
          <p className="text-sm text-text-secondary mb-4">
            Select platforms to post{" "}
            <span className="font-medium text-text-primary">
              {clip.title || `Clip #${clip.id}`}
            </span>
          </p>

          <div className="space-y-2">
            {PLATFORMS.map((platform) => (
              <div
                key={platform.key}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedPlatforms.has(platform.key)
                    ? "border-accent-400 bg-accent-400/5"
                    : "border-border-base hover:bg-surface-elevated"
                }`}
                onClick={() => !isPosting && togglePlatform(platform.key)}
              >
                <div className="flex items-center gap-3">
                  <Icon icon={platform.icon} className="text-xl" />
                  <span className="text-sm font-medium text-text-primary">
                    {platform.name}
                  </span>
                </div>
                <Switch
                  size="sm"
                  isSelected={selectedPlatforms.has(platform.key)}
                  onValueChange={() => togglePlatform(platform.key)}
                  isDisabled={isPosting}
                />
              </div>
            ))}
          </div>
        </ModalBody>

        <ModalFooter className="flex items-center justify-between">
          <div className="text-sm text-text-secondary">
            {creditCount > 0 ? (
              <span>
                <span className="font-semibold text-text-primary">
                  {creditCount}
                </span>{" "}
                credit{creditCount !== 1 ? "s" : ""}
              </span>
            ) : (
              "Select platforms"
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="flat" onPress={onClose} isDisabled={isPosting}>
              Cancel
            </Button>
            <Button
              color="primary"
              className="bg-accent-400"
              isLoading={isPosting}
              isDisabled={creditCount === 0 || isPosting}
              onPress={handlePost}
              startContent={
                !isPosting && <Icon icon="mdi:megaphone" />
              }
            >
              Post
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
