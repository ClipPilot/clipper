"use client";

import React, { useState } from "react";
import {
  Button,
  Input,
  Modal,
  Slider,
  Spinner,
  toast,
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
import { formatCents } from "@/lib/formatters";

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
      toast.danger("Card setup failed", { description: error.message || "Something went wrong" });
      setIsSubmitting(false);
      return;
    }

    if (setupIntent?.payment_method) {
      try {
        const pmId =
          typeof setupIntent.payment_method === "string"
            ? setupIntent.payment_method
            : setupIntent.payment_method.id;

        const { card } = await campaignAPI.saveCard(teamId, campaignId, pmId);

        toast.success("Payment method saved");
        if (card) onSaved(card);
        onClose();
      } catch (err: any) {
        toast.danger("Failed to save card", { description: err.message || "Something went wrong" });
      }
    }

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon
            icon="solar:card-bold-duotone"
            className="text-accent-400"
            width={24}
          />
          <span className="text-text-primary">Add Payment Method</span>
        </div>
      </Modal.Header>
      <Modal.Body className="py-6 gap-5">
        <p className="text-sm text-text-secondary">
          Add a card or bank account to fund your campaign. Your payment method
          will be saved for future top-ups.
        </p>
        <PaymentElement />
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="tertiary"
          className="bg-white/[0.04] text-text-secondary"
          onPress={onClose}
          isDisabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-accent-400 text-white font-medium"
          isPending={isSubmitting}
          isDisabled={!stripe || !elements}
        >
          Save Payment Method
        </Button>
      </Modal.Footer>
    </form>
  );
}

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
          toast.success("Wallet funded", { description: `${formatCents(amountCents)} added to your campaign wallet.` });
          onClose();
          return;
        }
      } catch {
      }
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
            <Icon
              icon="solar:wallet-bold-duotone"
              className="text-accent-400"
              width={24}
            />
            <span className="text-text-primary">Processing Payment</span>
          </div>
        </Modal.Header>
        <Modal.Body className="py-10 flex flex-col items-center gap-4">
          <Spinner size="lg" color="accent" />
          <p className="text-text-secondary text-center">
            Crediting your campaign wallet...
          </p>
          <p className="text-text-tertiary text-sm text-center">
            This usually takes a few seconds
          </p>
        </Modal.Body>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Icon
            icon="solar:wallet-bold-duotone"
            className="text-accent-400"
            width={24}
          />
          <span className="text-text-primary">Add Funds</span>
        </div>
      </Modal.Header>
      <Modal.Body className="py-6 gap-5">
        <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.04]">
          <span className="text-text-secondary">Amount</span>
          <span className="text-xl font-bold text-text-primary">
            {formatCents(amountCents)}
          </span>
        </div>
        <PaymentElement />
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="tertiary"
          className="bg-white/[0.04] text-text-secondary"
          onPress={onClose}
          isDisabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-accent-400 text-white font-medium"
          isPending={isSubmitting}
          isDisabled={!stripe || !elements}
        >
          Pay {formatCents(amountCents)}
        </Button>
      </Modal.Footer>
    </form>
  );
}

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
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose} isDismissable={false}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <StripeProvider clientSecret={clientSecret}>
              <SetupForm
                teamId={teamId}
                campaignId={campaignId}
                onSaved={onSaved}
                onClose={onClose}
              />
            </StripeProvider>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

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
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose} isDismissable={false}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
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
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function SavedPaymentMethodDisplay({ pm }: { pm: CampaignCard }) {
  const isBank = pm.type === "us_bank_account";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04]">
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
        className="text-green-500"
        width={18}
      />
    </div>
  );
}

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
      toast.danger("Failed to start card setup", { description: err.message || "Something went wrong" });
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
      toast.success("Credits applied", { description: `${creditsUsed} credit${creditsUsed > 1 ? "s" : ""} converted to ${formatCents(amountCents)} campaign dollars.` });
      setCreditCount(0);
      onPaymentComplete(balanceCents);
      refetchUsage();
      triggerRefresh();
    } catch (err: any) {
      toast.danger("Failed to apply credits", { description: err.message || "Something went wrong" });
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
          toast.success("Wallet funded", { description: `${formatCents(amountCents)} added to your campaign wallet.` });
          setAmountInput("");
          setIsPolling(false);
          onPaymentComplete(gate.balanceCents + amountCents);
          return;
        }
      } catch {
      }
    }

    toast.warning("Still processing", { description: "Your payment succeeded but funds are still being credited. They'll appear shortly." });
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
        setIsCreatingIntent(false);
        toast.success("Wallet funded", { description: `${formatCents(cents)} added to your campaign wallet.` });
        setAmountInput("");
        onPaymentComplete(gate.balanceCents + cents);
      } else if (processing) {
        setIsCreatingIntent(false);
        toast.warning("Bank transfer initiated", { description: "Your bank transfer is processing. Funds will be credited in 3-5 business days." });
        setAmountInput("");
      } else {
        setClientSecret(cs);
        setPaymentIntentId(piId);
        setPendingAmountCents(cents);
        setIsPaymentModalOpen(true);
        setIsCreatingIntent(false);
      }
    } catch (err: any) {
      toast.danger("Failed to initiate payment", { description: err.message || "Something went wrong" });
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
      <div className="rounded-xl bg-white/[0.04] overflow-hidden">
        <div className="p-4 grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs text-text-secondary mb-1">Budget</p>
            <p className="text-base font-bold text-text-primary">
              {budget > 0 ? formatDollars(budget) : "\u2014"}
            </p>
          </div>
          <div className="text-center border-l border-border-base">
            <p className="text-xs text-text-secondary mb-1">CPM Rate</p>
            <p className="text-base font-bold text-text-primary">
              {cpm > 0 ? `$${cpm.toFixed(2)}` : "\u2014"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04]">
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
          <div className="flex items-center gap-1.5 text-green-500 text-sm font-medium">
            <Icon icon="solar:check-circle-bold" width={18} />
            Funded
          </div>
        ) : (
          <div className="text-right">
            <p className="text-xs text-text-secondary">Required</p>
            <p className="text-sm font-semibold text-yellow-400">
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
              variant="primary"
              onPress={handleAddCard}
              isPending={isSettingUp}
            >
              {!isSettingUp && (
                <Icon icon="solar:card-bold-duotone" width={16} />
              )}
              Add Payment Method
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Payment Method
              </p>
              <Button
                size="sm"
                variant="tertiary"
                className="text-text-secondary h-6 text-xs"
                onPress={handleAddCard}
                isPending={isSettingUp}
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
              <div className="p-4 rounded-xl bg-white/[0.03] border border-border-base space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-text-primary">
                    <Icon icon="solar:stars-bold-duotone" width={16} className="text-pink-500" />
                    <span>1 credit = <strong className="text-pink-500">$3.50</strong> campaign dollars</span>
                  </div>
                  <span className="text-xs text-text-tertiary">{totalCredits} available</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-text-primary">{creditCount} credit{creditCount !== 1 ? "s" : ""}</span>
                    <span className="font-semibold text-pink-500">${(creditCount * 3.5).toFixed(2)}</span>
                  </div>
                  <div className="relative h-6 flex items-center">
                    <div className="absolute inset-x-0 h-2 rounded-full bg-white/[0.12]" />
                    <div
                      className="absolute h-2 rounded-full bg-pink-500 transition-all"
                      style={{ width: maxCreditsSlider > 0 ? `${(creditCount / maxCreditsSlider) * 100}%` : "0%" }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={maxCreditsSlider}
                      step={1}
                      value={creditCount}
                      onChange={(e) => setCreditCount(Number(e.target.value))}
                      className="absolute inset-x-0 w-full h-6 opacity-0 cursor-pointer"
                    />
                    <div
                      className="absolute w-4 h-4 rounded-full bg-pink-500 border-2 border-white shadow-lg pointer-events-none transition-all"
                      style={{ left: maxCreditsSlider > 0 ? `calc(${(creditCount / maxCreditsSlider) * 100}% - 8px)` : "0" }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-text-tertiary">
                    <span>0</span>
                    <span>{maxCreditsSlider}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-pink-500 text-white w-full hover:bg-pink-600"
                  onPress={handleFundWithCredits}
                  isPending={isFundingWithCredits}
                  isDisabled={creditCount === 0}
                >
                  {!isFundingWithCredits && <Icon icon="solar:stars-bold-duotone" width={16} />}
                  Apply {creditCount} Credit{creditCount !== 1 ? "s" : ""}
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
                  onChange={(e) => setAmountInput(e.target.value)}
                  type="number"
                  min="1"
                  step="0.01"
                  className="border-border-base bg-white/[0.04] text-text-primary text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddFunds();
                  }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onPress={handleAddFunds}
                  isPending={isCreatingIntent || isPolling}
                  isDisabled={!amountIsValid || isPolling}
                >
                  {!isCreatingIntent && !isPolling && (
                    <Icon icon="solar:wallet-bold-duotone" width={16} />
                  )}
                  {isPolling ? "Processing..." : "Add Funds"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

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
