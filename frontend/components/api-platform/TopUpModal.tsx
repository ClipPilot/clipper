"use client";

import React, { useState } from "react";
import { Modal, Button, Spinner, toast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import StripeProvider from "@/components/providers/StripeProvider";
import { apiPlatformAPI } from "@/api/apiPlatform";
import { formatCents } from "@/lib/formatters";

type ModalStage = "form" | "crediting";

interface TopUpFormProps {
  amountCents: number;
  teamId: number;
  paymentIntentId: string;
  onSuccess: () => void;
  onClose: () => void;
}

function TopUpForm({ amountCents, teamId, paymentIntentId, onSuccess, onClose }: TopUpFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [stage, setStage] = useState<ModalStage>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollForCredit = async () => {
    const maxAttempts = 20;
    const interval = 1500;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, interval));
      try {
        const { credited } = await apiPlatformAPI.getTopUpStatus(teamId, paymentIntentId);
        if (credited) {
          onSuccess();
          toast.success("Wallet funded", { description: `${formatCents(amountCents)} added to your balance` });
          onClose();
          return;
        }
      } catch {}
    }
    toast.warning("Still processing", { description: "Your payment succeeded but funds are still being credited. They'll appear shortly." });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (error) {
      toast.danger("Payment failed", { description: error.message || "Something went wrong" });
      setIsSubmitting(false);
      return;
    }
    setStage("crediting");
    await pollForCredit();
  };

  if (stage === "crediting") {
    return (
      <>
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:wallet-bold-duotone" className="text-accent-400" width={24} />
            <span className="text-text-primary">Processing Payment</span>
          </div>
        </Modal.Header>
        <Modal.Body className="py-10 flex flex-col items-center gap-4">
          <Spinner size="lg" color="accent" />
          <p className="text-text-secondary text-center">Crediting your wallet...</p>
          <p className="text-text-tertiary text-sm text-center">This usually takes a few seconds</p>
        </Modal.Body>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:wallet-bold-duotone" className="text-accent-400" width={24} />
          <span className="text-text-primary">Top Up Wallet</span>
        </div>
      </Modal.Header>
      <Modal.Body className="py-6 space-y-5">
        <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.04]">
          <span className="text-text-secondary">Amount</span>
          <span className="text-xl font-bold text-text-primary">{formatCents(amountCents)}</span>
        </div>
        <PaymentElement />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onPress={onClose} isDisabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" className="bg-accent-400 text-white font-medium" isPending={isSubmitting} isDisabled={!stripe || !elements}>
          Pay {formatCents(amountCents)}
        </Button>
      </Modal.Footer>
    </form>
  );
}

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientSecret: string | null;
  paymentIntentId: string | null;
  amountCents: number;
  teamId: number;
  onSuccess: () => void;
}

export default function TopUpModal({
  isOpen,
  onClose,
  clientSecret,
  paymentIntentId,
  amountCents,
  teamId,
  onSuccess,
}: TopUpModalProps) {
  if (!clientSecret || !paymentIntentId) return null;

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose} isDismissable={false}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <StripeProvider clientSecret={clientSecret}>
              <TopUpForm
                amountCents={amountCents}
                teamId={teamId}
                paymentIntentId={paymentIntentId}
                onSuccess={onSuccess}
                onClose={onClose}
              />
            </StripeProvider>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
