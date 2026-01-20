"use client";

import React, { useState, useRef } from "react";
import { Card, CardBody, CardFooter, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Clip } from "@/api/clips";
import { SecureVideoPlayer, SecureVideoPlayerRef } from "./SecureVideoPlayer";

interface UnsavedClipCardProps {
  clip: Clip;
  onSave: (clipId: number) => Promise<void>;
  onReject?: (clipId: number) => void;
  onView?: () => void;
  isSaving?: boolean;
}

export const UnsavedClipCard: React.FC<UnsavedClipCardProps> = ({
  clip,
  onSave,
  onReject,
  onView,
  isSaving = false,
}) => {
  const [isLocalSaving, setIsLocalSaving] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const videoRef = useRef<SecureVideoPlayerRef>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getScoreClasses = (score?: number) => {
    if (!score && score !== 0) return "text-accent-400 bg-accent-400/10";
    if (score >= 80) return "text-success-600 bg-success-600/10";
    if (score >= 60) return "text-warning-600 bg-warning-600/10";
    return "text-text-tertiary bg-surface-elevated";
  };

  const handleSave = async () => {
    setIsLocalSaving(true);
    try {
      await onSave(clip.id);
    } finally {
      setIsLocalSaving(false);
    }
  };

  const saving = isSaving || isLocalSaving;

  const handleCardClick = () => {
    if (onView) {
      // Pause the video before opening modal
      videoRef.current?.pause();
      onView();
    }
  };

  return (
    <Card className="bg-surface-base border border-border-accent overflow-hidden">
      <CardBody className="p-0 cursor-pointer" onClick={handleCardClick}>
        <div className="aspect-[9/16]">
          {clip.clipUrl ? (
            <SecureVideoPlayer
              ref={videoRef}
              src={clip.clipUrl}
              poster={clip.sourceVideoUrl}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-dark">
              <Icon
                icon="solar:video-frame-play-vertical-bold-duotone"
                className="text-5xl text-accent-400"
              />
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {clip.title || `Clip #${clip.id}`}
            </h3>
            {clip.clip_score !== undefined && clip.clip_score !== null && (
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${getScoreClasses(
                  clip.clip_score
                )}`}
              >
                <Icon icon="solar:star-bold" className="text-xs" />
                <span className="text-xs font-medium">{clip.clip_score}</span>
              </div>
            )}
          </div>

          {clip.message && (
            <p className="text-xs text-text-secondary line-clamp-2 mb-2">
              {clip.message}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            <div className="flex items-center gap-1">
              <Icon icon="solar:clock-circle-outline" className="text-sm" />
              <span>{formatDate(clip.created_at)}</span>
            </div>
          </div>
        </div>
      </CardBody>

      <CardFooter className="px-3 py-2.5 border-t border-border-base flex gap-2">
        <Button
          className="flex-1 justify-center"
          color="primary"
          size="sm"
          onPress={handleSave}
          isLoading={saving}
          isDisabled={saving}
        >
          <span className="flex items-center gap-1.5">
            {!saving && <Icon icon="solar:diskette-bold" className="text-sm" />}
            <span className="text-xs sm:text-sm">{saving ? "Saving..." : "Save"}</span>
            {!saving && (
              <span className="px-1.5 py-0.5 text-[10px] bg-white/20 rounded-full font-medium hidden sm:inline">
                1 Credit
              </span>
            )}
          </span>
        </Button>

        {onReject && (
          <Button
            size="sm"
            variant="flat"
            color="danger"
            isIconOnly
            className="flex-shrink-0"
            onPress={() => setIsRejectModalOpen(true)}
            isDisabled={saving}
          >
            <Icon icon="solar:close-circle-bold" className="text-lg" />
          </Button>
        )}
      </CardFooter>

      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        size="sm"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-danger">
              <Icon icon="solar:danger-triangle-bold" className="text-xl" />
              Reject Clip
            </div>
          </ModalHeader>
          <ModalBody>
            <p className="text-text-secondary">
              Are you sure you want to reject this clip? The clip will be marked as rejected and won't count towards your saved clips.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => setIsRejectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={() => {
                onReject?.(clip.id);
                setIsRejectModalOpen(false);
              }}
              startContent={<Icon icon="solar:close-circle-bold" />}
            >
              Reject
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
};
