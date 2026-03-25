"use client";

import React from "react";
import { Modal,
  Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  clipName?: string;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  clipName,
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}><Modal.Container><Modal.Dialog className="sm:max-w-sm bg-surface-base border border-border-accent">
<Modal.Header className="flex flex-col items-start border-b border-border-base pb-4">
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 rounded-full bg-danger-500/10 flex items-center justify-center">
                  <Icon
                    icon="solar:trash-bin-trash-bold-duotone"
                    className="text-2xl text-danger-500"
                  />
                </div>
                <h3 className="text-xl font-bold text-text-accent">Delete Clip</h3>
              </div>
            </Modal.Header>
            <Modal.Body className="py-6">
              <p className="text-text-secondary mb-2">
                Are you sure you want to delete this clip? This action cannot be undone.
              </p>
              {clipName && (
                <p className="text-text-accent font-medium mt-3">
                  <span className="text-text-tertiary">Clip:</span> {clipName}
                </p>
              )}
              <div className="mt-4 p-3 rounded-lg bg-danger-500/5 border border-danger-500/20 flex gap-2">
                <Icon icon="solar:danger-triangle-bold" className="text-danger-500 text-lg flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-500">
                  All associated files will be permanently deleted from storage.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer className="border-t border-border-base pt-4">
              <Button
 variant="tertiary"
 onPress={onClose}
 isDisabled={isDeleting}
 className="bg-surface-elevated hover:bg-surface-raised text-text-accent"
 >
                Cancel
              </Button>
              <Button variant="danger"
 onPress={handleConfirm}
 isPending={isDeleting}
 className="bg-danger-500 hover:bg-danger-600 text-white font-semibold"
 >
                {isDeleting ? "Deleting..." : "Delete Clip"}
              </Button>
            </Modal.Footer>
          
</Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
};
