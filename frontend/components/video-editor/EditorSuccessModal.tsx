"use client";

import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface EditorSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * EditorSuccessModal
 *
 * Shown after the user successfully submits a video edit job.
 * Closing the modal (via the button or backdrop) triggers onClose,
 * which the parent uses to redirect to the clips dashboard.
 *
 * Usage:
 *   <EditorSuccessModal
 *     isOpen={showSuccessModal}
 *     onClose={handleSuccessModalClose}
 *   />
 */
export function EditorSuccessModal({ isOpen, onClose }: EditorSuccessModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      classNames={{
        base: "bg-surface-base border border-border-base",
        header: "border-b border-border-base",
        body: "py-6",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Icon icon="solar:check-circle-bold" className="text-primary-400 text-xl" />
            </div>
            <span className="text-text-primary">Changes Submitted</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="text-text-secondary">
            Your changes are being applied to the video. This usually takes 1-2 minutes.
          </p>
          <p className="text-text-tertiary text-sm mt-2">
            You&apos;ll be redirected to view your clips where you can track the progress.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            color="primary"
            onPress={onClose}
            startContent={<Icon icon="solar:arrow-right-outline" />}
          >
            View My Clips
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
