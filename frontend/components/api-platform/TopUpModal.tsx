"use client";

import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import StripeProvider from "@/components/providers/StripeProvider";
import { apiPlatformAPI } from "@/api/apiPlatform";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

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
          addToast({ title: "Wallet funded", description: `${formatCents(amountCents)} added to your balance`, color: "success" });
          onClose();
          return;
        }
      } catch {
        // ignore polling errors, keep trying
      }
    }

    addToast({
      title: "Still processing",
      description: "Your payment succeeded but funds are still being credited. They'll appear shortly.",
      color: "warning",
    });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsSubmitting(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      addToast({
        title: "Payment failed",
        description: error.message || "Something went wrong",
        color: "danger",
      });
      setIsSubmitting(false);
      return;
    }

    setStage("crediting");
    await pollForCredit();
  };

  if (stage === "crediting") {
    return (
      <>
        <ModalHeader className="border-b border-border-base">
          <div className="flex items-center gap-2">
            <Icon icon="solar:wallet-bold-duotone" className="text-accent-400" width={24} />
            <span className="text-text-primary">Processing Payment</span>
          </div>
        </ModalHeader>
        <ModalBody className="py-10 flex flex-col items-center gap-4">
          <Spinner size="lg" color="secondary" />
          <p className="text-text-secondary text-center">
            Crediting your wallet...
          </p>
          <p className="text-text-tertiary text-sm text-center">
            This usually takes a few seconds
          </p>
        </ModalBody>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <ModalHeader className="border-b border-border-base">
        <div className="flex items-center gap-2">
          <Icon icon="solar:wallet-bold-duotone" className="text-accent-400" width={24} />
          <span className="text-text-primary">Top Up Wallet</span>
        </div>
      </ModalHeader>
      <ModalBody className="py-6 gap-5">
        <div className="flex items-center justify-between p-4 rounded-lg bg-surface-elevated">
          <span className="text-text-secondary">Amount</span>
          <span className="text-xl font-bold text-text-primary">
            {formatCents(amountCents)}
          </span>
        </div>
        <PaymentElement />
      </ModalBody>
      <ModalFooter className="border-t border-border-base">
        <Button
          variant="flat"
          className="bg-surface-elevated text-text-secondary"
          onPress={onClose}
          isDisabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-accent-400 text-white font-medium"
          isLoading={isSubmitting}
          isDisabled={!stripe || !elements}
        >
          Pay {formatCents(amountCents)}
        </Button>
      </ModalFooter>
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      classNames={{
        base: "bg-surface-base border border-border-base",
      }}
      isDismissable={false}
    >
      <ModalContent>
        <StripeProvider clientSecret={clientSecret}>
          <TopUpForm
            amountCents={amountCents}
            teamId={teamId}
            paymentIntentId={paymentIntentId}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        </StripeProvider>
      </ModalContent>
    </Modal>
  );
}
