"use client";

import { Modal } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { CampaignVideo } from "@/api/campaign";

interface VideoPreviewModalProps {
  video: CampaignVideo | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoPreviewModal({ video, isOpen, onClose }: VideoPreviewModalProps) {
  if (!video) return null;
  const src = video.presigned_url;

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}><Modal.Container><Modal.Dialog className="sm:max-w-2xl">
        <Modal.Header className="border-b border-border-base">
          <div className="flex items-center gap-2 min-w-0">
            <Icon
              icon="solar:video-frame-play-vertical-bold-duotone"
              className="text-accent-400 flex-shrink-0"
              width={20}
            />
            <span className="text-text-accent truncate">
              {video.title ?? video.file_name ?? `Video #${video.id}`}
            </span>
          </div>
        </Modal.Header>
        <Modal.Body className="py-4 flex items-center justify-center">
          {src ? (
            <video
              src={src}
              controls
              autoPlay
              className="w-full max-h-[70vh] rounded-lg bg-black"
              playsInline
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Icon
                icon="solar:video-library-bold-duotone"
                className="text-text-tertiary"
                width={40}
              />
              <p className="text-sm text-text-secondary">
                Video not available for preview
              </p>
            </div>
          )}
        </Modal.Body>
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
}
