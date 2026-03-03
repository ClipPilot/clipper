"use client";

import React, { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Slider,
  Spinner,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useUsageStatsRefresh } from "@/contexts/UsageStatsContext";
import StripeProvider from "@/components/providers/StripeProvider";
import {
  campaignAPI,
  type Campaign,
  type CampaignCard,
  type CampaignGates,
} from "@/api/campaign";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDollars(dollars: number): string {
  return `$${dollars.toLocaleString()}`;
}

function cardBrandIcon(brand: string): string {
  switch (brand) {
    case "visa":
      return "logos:visa";
    case "mastercard":
      return "logos:mastercard";
    case "amex":
      return "logos:amex";
    default:
      return "solar:card-bold-duotone";
  }
}

// ── Step 1: Setup form (save a card) ─────────────────────────────────────────

interface SetupFormProps {
  teamId: number;
  campaignId: number;
  onSaved: (card: CampaignCard) => void;
  onClose: () => void;
}

function SetupForm({ teamId, campaignId, onSaved, onClose }: SetupFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsSubmitting(true);

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (error) {
      addToast({
        title: "Card setup failed",
        description: error.message || "Something went wrong",
        color: "danger",
      });
      setIsSubmitting(false);
      return;
    }

    // Save the payment method to the wallet
    if (setupIntent?.payment_method) {
      try {
        const pmId =
          typeof setupIntent.payment_method === "string"
            ? setupIntent.payment_method
            : setupIntent.payment_method.id;

        const { card } = await campaignAPI.saveCard(teamId, campaignId, pmId);

        addToast({ title: "Payment method saved", color: "success" });
        if (card) onSaved(card);
        onClose();
      } catch (err: any) {
        addToast({
          title: "Failed to save card",
          description: err.message || "Something went wrong",
          color: "danger",
        });
      }
    }

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <ModalHeader className="border-b border-border-base">
        <div className="flex items-center gap-2">
          <Icon
            icon="solar:card-bold-duotone"
            className="text-accent-400"
            width={24}
          />
          <span className="text-text-primary">Add Payment Method</span>
        </div>
      </ModalHeader>
      <ModalBody className="py-6 gap-5">
        <p className="text-sm text-text-secondary">
          Add a card or bank account to fund your campaign. Your payment method
          will be saved for future top-ups.
        </p>
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
          Save Payment Method
        </Button>
      </ModalFooter>
    </form>
  );
}

// ── Step 2: Payment form (charge saved card) ─────────────────────────────────

interface PaymentFormProps {
  amountCents: number;
  teamId: number;
  campaignId: number;
  paymentIntentId: string;
  onSuccess: () => void;
  onClose: () => void;
}

function PaymentForm({
  amountCents,
  teamId,
  campaignId,
  paymentIntentId,
  onSuccess,
  onClose,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [stage, setStage] = useState<"form" | "crediting">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollForCredit = async () => {
    const maxAttempts = 20;
    const intervalMs = 1500;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));
      try {
        const { credited } = await campaignAPI.getTopUpStatus(
          teamId,
          campaignId,
          paymentIntentId,
        );
        if (credited) {
          onSuccess();
          addToast({
            title: "Wallet funded",
            description: `${formatCents(amountCents)} added to your campaign wallet.`,
            color: "success",
          });
          onClose();
          return;
        }
      } catch {
        // ignore — keep polling
      }
    }

    addToast({
      title: "Still processing",
      description:
        "Your payment succeeded but funds are still being credited. They'll appear shortly.",
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
      confirmParams: { return_url: window.location.href },
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
            <Icon
              icon="solar:wallet-bold-duotone"
              className="text-accent-400"
              width={24}
            />
            <span className="text-text-primary">Processing Payment</span>
          </div>
        </ModalHeader>
        <ModalBody className="py-10 flex flex-col items-center gap-4">
          <Spinner size="lg" color="secondary" />
          <p className="text-text-secondary text-center">
            Crediting your campaign wallet...
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
          <Icon
            icon="solar:wallet-bold-duotone"
            className="text-accent-400"
            width={24}
          />
          <span className="text-text-primary">Add Funds</span>
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

// ── Setup Modal (Step 1) ─────────────────────────────────────────────────────

export interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientSecret: string | null;
  teamId: number;
  campaignId: number;
  onSaved: (card: CampaignCard) => void;
}

export function SetupModal({
  isOpen,
  onClose,
  clientSecret,
  teamId,
  campaignId,
  onSaved,
}: SetupModalProps) {
  if (!clientSecret) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      classNames={{ base: "bg-surface-base border border-border-base" }}
      isDismissable={false}
    >
      <ModalContent>
        <StripeProvider clientSecret={clientSecret}>
          <SetupForm
            teamId={teamId}
            campaignId={campaignId}
            onSaved={onSaved}
            onClose={onClose}
          />
        </StripeProvider>
      </ModalContent>
    </Modal>
  );
}

// ── Payment Modal (Step 2) ───────────────────────────────────────────────────

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientSecret: string | null;
  paymentIntentId: string | null;
  amountCents: number;
  teamId: number;
  campaignId: number;
  onSuccess: () => void;
}

function PaymentModal({
  isOpen,
  onClose,
  clientSecret,
  paymentIntentId,
  amountCents,
  teamId,
  campaignId,
  onSuccess,
}: PaymentModalProps) {
  if (!clientSecret || !paymentIntentId) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      classNames={{ base: "bg-surface-base border border-border-base" }}
      isDismissable={false}
    >
      <ModalContent>
        <StripeProvider clientSecret={clientSecret}>
          <PaymentForm
            amountCents={amountCents}
            teamId={teamId}
            campaignId={campaignId}
            paymentIntentId={paymentIntentId}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        </StripeProvider>
      </ModalContent>
    </Modal>
  );
}

// ── Saved Card Display ───────────────────────────────────────────────────────

function SavedPaymentMethodDisplay({ pm }: { pm: CampaignCard }) {
  const isBank = pm.type === "us_bank_account";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated border border-border-base">
      <Icon
        icon={isBank ? "solar:bank-bold-duotone" : cardBrandIcon(pm.brand ?? "")}
        width={isBank ? 24 : 32}
        className={isBank ? "text-accent-400" : undefined}
      />
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary capitalize">
          {isBank
            ? `${pm.bank_name || "Bank account"} ending in ${pm.last4}`
            : `${pm.brand} ending in ${pm.last4}`}
        </p>
        <p className="text-xs text-text-tertiary">
          {isBank
            ? "ACH bank transfer"
            : `Expires ${String(pm.exp_month).padStart(2, "0")}/${pm.exp_year}`}
        </p>
      </div>
      <Icon
        icon="solar:check-circle-bold"
        className="text-success-500"
        width={18}
      />
    </div>
  );
}

// ── Main PaymentGate ─────────────────────────────────────────────────────────

interface PaymentGateProps {
  campaignId: number;
  campaign: Campaign;
  gate: CampaignGates["payment"];
  savedCard: CampaignCard | null;
  onCardSaved: (card: CampaignCard) => void;
  onPaymentComplete: (newBalanceCents: number) => void;
}

export function PaymentGate({
  campaignId,
  campaign,
  gate,
  savedCard: initialCard,
  onCardSaved,
  onPaymentComplete,
}: PaymentGateProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const { usageStats, refetch: refetchUsage } = useUsageStats(selectedTeam?.id);
  const { triggerRefresh } = useUsageStatsRefresh();

  const [card, setCard] = useState<CampaignCard | null>(initialCard);
  React.useEffect(() => {
    setCard(initialCard);
  }, [initialCard]);

  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  const [creditCount, setCreditCount] = useState(0);
  const [isFundingWithCredits, setIsFundingWithCredits] = useState(false);

  const [amountInput, setAmountInput] = useState("");
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [pendingAmountCents, setPendingAmountCents] = useState(0);

  const budget = campaign.budget ? parseFloat(campaign.budget) : 0;
  const cpm = campaign.quoted_cpm ? parseFloat(campaign.quoted_cpm) : 0;
  const balanceDollars = gate.balanceCents / 100;
  const requiredDollars = gate.requiredCents / 100;
  const shortfallDollars = Math.max(0, requiredDollars - balanceDollars);

  const shortfallCents = Math.max(0, gate.requiredCents - gate.balanceCents);
  const totalCredits = usageStats?.totalRemaining ?? 0;
  const maxCreditsNeeded = Math.ceil(shortfallCents / 350);
  const maxCreditsSlider = Math.min(totalCredits, maxCreditsNeeded);

  const parsedAmount = parseFloat(amountInput);
  const amountIsValid = !isNaN(parsedAmount) && parsedAmount >= 1;

  const handleAddCard = async () => {
    if (!selectedTeam?.id) return;
    setIsSettingUp(true);
    try {
      const { clientSecret: cs } = await campaignAPI.createSetupIntent(
        selectedTeam.id,
        campaignId,
      );
      setSetupSecret(cs);
      setIsSetupModalOpen(true);
    } catch (err: any) {
      addToast({
        title: "Failed to start card setup",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleCardSaved = (newCard: CampaignCard) => {
    setCard(newCard);
    setIsSetupModalOpen(false);
    setSetupSecret(null);
    onCardSaved(newCard);
  };

  const handleFundWithCredits = async () => {
    if (!selectedTeam?.id || creditCount < 1) return;
    setIsFundingWithCredits(true);
    try {
      const { balanceCents, creditsUsed, amountCents } =
        await campaignAPI.fundWithCredits(selectedTeam.id, campaignId, creditCount);
      addToast({
        title: "Credits applied",
        description: `${creditsUsed} credit${creditsUsed > 1 ? "s" : ""} converted to ${formatCents(amountCents)} campaign dollars.`,
        color: "success",
      });
      setCreditCount(0);
      onPaymentComplete(balanceCents);
      refetchUsage();
      triggerRefresh();
    } catch (err: any) {
      addToast({
        title: "Failed to apply credits",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    } finally {
      setIsFundingWithCredits(false);
    }
  };

  const [isPolling, setIsPolling] = useState(false);

  const pollForCredit = async (piId: string, amountCents: number) => {
    setIsPolling(true);
    const maxAttempts = 20;
    const intervalMs = 1500;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));
      try {
        const { credited } = await campaignAPI.getTopUpStatus(
          selectedTeam!.id,
          campaignId,
          piId,
        );
        if (credited) {
          addToast({
            title: "Wallet funded",
            description: `${formatCents(amountCents)} added to your campaign wallet.`,
            color: "success",
          });
          setAmountInput("");
          setIsPolling(false);
          onPaymentComplete(gate.balanceCents + amountCents);
          return;
        }
      } catch {
        // ignore — keep polling
      }
    }

    addToast({
      title: "Still processing",
      description: "Your payment succeeded but funds are still being credited. They'll appear shortly.",
      color: "warning",
    });
    setIsPolling(false);
  };

  const handleAddFunds = async () => {
    if (!selectedTeam?.id || !amountIsValid) return;
    const cents = Math.round(parsedAmount * 100);
    setIsCreatingIntent(true);
    try {
      const { confirmed, processing, clientSecret: cs, paymentIntentId: piId } =
        await campaignAPI.createTopUp(selectedTeam.id, campaignId, cents);

      if (confirmed) {
        // Card was charged AND wallet credited server-side — instant
        setIsCreatingIntent(false);
        addToast({
          title: "Wallet funded",
          description: `${formatCents(cents)} added to your campaign wallet.`,
          color: "success",
        });
        setAmountInput("");
        onPaymentComplete(gate.balanceCents + cents);
      } else if (processing) {
        // ACH bank transfer — payment initiated, takes 3-5 business days
        setIsCreatingIntent(false);
        addToast({
          title: "Bank transfer initiated",
          description: "Your bank transfer is processing. Funds will be credited in 3-5 business days.",
          color: "warning",
        });
        setAmountInput("");
      } else {
        // No saved payment method — open payment modal
        setClientSecret(cs);
        setPaymentIntentId(piId);
        setPendingAmountCents(cents);
        setIsPaymentModalOpen(true);
        setIsCreatingIntent(false);
      }
    } catch (err: any) {
      addToast({
        title: "Failed to initiate payment",
        description: err.message || "Something went wrong",
        color: "danger",
      });
      setIsCreatingIntent(false);
    }
  };

  const handlePaymentModalClose = () => {
    setIsPaymentModalOpen(false);
    setClientSecret(null);
    setPaymentIntentId(null);
    setAmountInput("");
  };

  const handlePaymentSuccess = () => {
    onPaymentComplete(gate.balanceCents + pendingAmountCents);
    handlePaymentModalClose();
  };

  return (
    <div className="space-y-4">
      {/* Campaign terms summary */}
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="p-4 grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs text-text-secondary mb-1">Budget</p>
            <p className="text-base font-bold text-text-primary">
              {budget > 0 ? formatDollars(budget) : "—"}
            </p>
          </div>
          <div className="text-center border-l border-border-base">
            <p className="text-xs text-text-secondary mb-1">CPM Rate</p>
            <p className="text-base font-bold text-text-primary">
              {cpm > 0 ? `$${cpm.toFixed(2)}` : "—"}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Current balance */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-surface-elevated">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent-400/10 flex items-center justify-center">
            <Icon
              icon="solar:wallet-bold-duotone"
              className="text-accent-400"
              width={18}
            />
          </div>
          <div>
            <p className="text-xs text-text-secondary">
              Campaign Wallet Balance
            </p>
            <p className="text-lg font-bold text-text-primary">
              {formatCents(gate.balanceCents)}
            </p>
          </div>
        </div>
        {gate.complete ? (
          <div className="flex items-center gap-1.5 text-success-500 text-sm font-medium">
            <Icon icon="solar:check-circle-bold" width={18} />
            Funded
          </div>
        ) : (
          <div className="text-right">
            <p className="text-xs text-text-secondary">Required</p>
            <p className="text-sm font-semibold text-warning-400">
              {formatCents(gate.requiredCents)}
            </p>
          </div>
        )}
      </div>

      {!card ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Step 1 — Add Payment Method
          </p>
          <div className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-border-base">
            <Icon
              icon="solar:card-bold-duotone"
              className="text-text-tertiary"
              width={24}
            />
            <div className="flex-1">
              <p className="text-sm text-text-secondary">
                No payment method on file
              </p>
              <p className="text-xs text-text-tertiary">
                Add a card or bank account to fund your campaign
              </p>
            </div>
            <Button
              size="sm"
              color="primary"
              onPress={handleAddCard}
              isLoading={isSettingUp}
              startContent={
                !isSettingUp && (
                  <Icon icon="solar:card-bold-duotone" width={16} />
                )
              }
            >
              Add Payment Method
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Saved card display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Payment Method
              </p>
              <Button
                size="sm"
                variant="light"
                className="text-text-secondary h-6 text-xs"
                onPress={handleAddCard}
                isLoading={isSettingUp}
              >
                Change
              </Button>
            </div>
            <SavedPaymentMethodDisplay pm={card} />
          </div>

          {!gate.complete && totalCredits > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Fund with Credits
              </p>
              <div className="p-4 rounded-lg border border-border-base bg-surface-elevated space-y-4">
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  <Icon icon="solar:transfer-horizontal-bold" width={14} />
                  <span>1 credit = $3.50 campaign dollars</span>
                </div>
                <Slider
                  value={creditCount}
                  onChange={(val) => setCreditCount(val as number)}
                  minValue={0}
                  maxValue={maxCreditsSlider}
                  step={1}
                  size="sm"
                  color="secondary"
                  showTooltip
                  label={`${creditCount} credit${creditCount !== 1 ? "s" : ""}`}
                  classNames={{
                    label: "text-sm text-text-primary font-medium",
                  }}
                />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-secondary">
                    {creditCount} credit{creditCount !== 1 ? "s" : ""} ={" "}
                    <span className="font-semibold text-text-primary">
                      ${(creditCount * 3.5).toFixed(2)}
                    </span>{" "}
                    campaign dollars
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {totalCredits} credit{totalCredits !== 1 ? "s" : ""} available
                  </p>
                </div>
                <Button
                  size="sm"
                  color="secondary"
                  onPress={handleFundWithCredits}
                  isLoading={isFundingWithCredits}
                  isDisabled={creditCount === 0}
                  startContent={
                    !isFundingWithCredits && (
                      <Icon icon="solar:stars-bold-duotone" width={16} />
                    )
                  }
                >
                  Apply Credits
                </Button>
              </div>
            </div>
          )}

          {!gate.complete && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Add Funds
              </p>

              {shortfallDollars > 0 && (
                <p className="text-xs text-text-secondary flex items-center gap-1">
                  <Icon icon="solar:info-circle-bold" width={14} />
                  Add at least{" "}
                  <span className="font-semibold text-text-primary">
                    {formatDollars(shortfallDollars)}
                  </span>{" "}
                  to meet the requirement.
                </p>
              )}

              <div className="flex items-center gap-2">
                <Input
                  placeholder={`Min $${shortfallDollars > 0 ? shortfallDollars.toFixed(2) : "1.00"}`}
                  value={amountInput}
                  onValueChange={setAmountInput}
                  type="number"
                  min="1"
                  step="0.01"
                  size="sm"
                  variant="bordered"
                  startContent={
                    <span className="text-text-secondary text-sm">$</span>
                  }
                  classNames={{
                    inputWrapper: "border-border-base bg-surface-elevated",
                    input: "text-text-primary",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddFunds();
                  }}
                />
                <Button
                  color="primary"
                  size="sm"
                  onPress={handleAddFunds}
                  isLoading={isCreatingIntent || isPolling}
                  isDisabled={!amountIsValid || isPolling}
                  startContent={
                    !isCreatingIntent && !isPolling && (
                      <Icon icon="solar:wallet-bold-duotone" width={16} />
                    )
                  }
                >
                  {isPolling ? "Processing..." : "Add Funds"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Setup modal (Step 1) */}
      <SetupModal
        isOpen={isSetupModalOpen}
        onClose={() => {
          setIsSetupModalOpen(false);
          setSetupSecret(null);
        }}
        clientSecret={setupSecret}
        teamId={selectedTeam?.id ?? 0}
        campaignId={campaignId}
        onSaved={handleCardSaved}
      />

      {/* Payment modal (Step 2) */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={handlePaymentModalClose}
        clientSecret={clientSecret}
        paymentIntentId={paymentIntentId}
        amountCents={pendingAmountCents}
        teamId={selectedTeam?.id ?? 0}
        campaignId={campaignId}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
