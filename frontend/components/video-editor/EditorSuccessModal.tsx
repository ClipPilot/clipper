"use client";

import React from "react";
import { Modal,
  Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface EditorSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditorSuccessModal({ isOpen, onClose }: EditorSuccessModalProps) {
  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}><Modal.Container><Modal.Dialog className="sm:max-w-md">
        <Modal.Header className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Icon icon="solar:check-circle-bold" className="text-primary-400 text-xl" />
            </div>
            <span className="text-text-primary">Changes Submitted</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          <p className="text-text-secondary">
            Your changes are being applied to the video. This usually takes 1-2 minutes.
          </p>
          <p className="text-text-tertiary text-sm mt-2">
            You&apos;ll be redirected to view your clips where you can track the progress.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onPress={onClose}
          >
            <Icon icon="solar:arrow-right-outline" />
            View My Clips
          </Button>
        </Modal.Footer>
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
}
