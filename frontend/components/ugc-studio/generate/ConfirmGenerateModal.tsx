"use client";

import { Modal,
  Button } from "@heroui/react";
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
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}><Modal.Container><Modal.Dialog className="sm:max-w-md">
        <Modal.Header>
          <span className="text-text-primary">Confirm Video Generation</span>
        </Modal.Header>
        <Modal.Body>
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
        </Modal.Body>
        <Modal.Footer>
          <Button
 variant="outline"
 className="border-border-base text-text-secondary"
 onPress={onClose}
 >
            Cancel
          </Button>
          <Button
 className={accentButtonClass}
 onPress={onConfirm}
 >
            <Icon icon="solar:play-bold" width={16} />
            Generate Video
          </Button>
        </Modal.Footer>
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
}
