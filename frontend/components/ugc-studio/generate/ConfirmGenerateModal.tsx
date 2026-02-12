"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { BrandLogo } from "@/components/brand-logo";

interface ConfirmGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  creditCost: number;
  creditsRemaining: number;
  accentTextClass: string;
  accentButtonClass: string;
}

export function ConfirmGenerateModal({
  isOpen,
  onClose,
  onConfirm,
  creditCost,
  creditsRemaining,
  accentTextClass,
  accentButtonClass,
}: ConfirmGenerateModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      classNames={{
        base: "bg-surface-elevated border border-border-base",
        header: "border-b border-border-base",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader>
          <span className="text-text-primary">Confirm Video Generation</span>
        </ModalHeader>
        <ModalBody>
          <div className="text-center py-4">
            <div className="flex justify-center mb-4">
              <BrandLogo size={64} />
            </div>
            <p className="text-text-primary mb-2">
              This will use{" "}
              <span className={`font-bold ${accentTextClass}`}>
                {creditCost} credits
              </span>
            </p>
            <p className="text-xs text-text-muted mb-2">
              Based on estimated video length
            </p>
            <p className="text-sm text-text-secondary">
              You&apos;ll have {creditsRemaining - creditCost} credits remaining
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="bordered"
            className="border-border-base text-text-secondary"
            onPress={onClose}
          >
            Cancel
          </Button>
          <Button
            className={accentButtonClass}
            onPress={onConfirm}
            startContent={<Icon icon="solar:play-bold" width={16} />}
          >
            Generate Video
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
