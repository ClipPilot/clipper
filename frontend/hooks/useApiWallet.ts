"use client";

import { useState, useCallback, useEffect } from "react";
import { useAtom } from "jotai";
import { toast } from "@heroui/react";
import { selectedTeamAtom } from "@/store/auth";
import {
  apiPlatformAPI,
  type Wallet,
  type AutoRefillSettings,
} from "@/api/apiPlatform";

export function useApiWallet() {
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const teamId = selectedTeam?.id;

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpClientSecret, setTopUpClientSecret] = useState<string | null>(null);
  const [topUpPaymentIntentId, setTopUpPaymentIntentId] = useState<string | null>(null);
  const [topUpAmountCents, setTopUpAmountCents] = useState(0);
  const [isCreatingTopUp, setIsCreatingTopUp] = useState(false);

  const [autoRefill, setAutoRefill] = useState<AutoRefillSettings | null>(null);
  const [autoRefillLoading, setAutoRefillLoading] = useState(true);
  const [autoRefillSaving, setAutoRefillSaving] = useState(false);

  const fetchWallet = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await apiPlatformAPI.getWallet(teamId);
      setWallet(data);
    } catch {
      toast.danger("Error", { description: "Failed to load wallet" });
    } finally {
      setWalletLoading(false);
    }
  }, [teamId]);

  const fetchAutoRefill = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await apiPlatformAPI.getAutoRefill(teamId);
      setAutoRefill(data);
    } catch {
      // Non-critical
    } finally {
      setAutoRefillLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchWallet();
    fetchAutoRefill();
  }, [fetchWallet, fetchAutoRefill]);

  const handleTopUp = async () => {
    if (!teamId) return;
    const cents = Math.round(parseFloat(topUpAmount) * 100);
    if (isNaN(cents) || cents < 500) {
      toast.danger("Invalid amount", { description: "Minimum top-up is $5.00" });
      return;
    }
    setIsCreatingTopUp(true);
    try {
      const { clientSecret, paymentIntentId } = await apiPlatformAPI.createTopUp(teamId, cents);
      setTopUpClientSecret(clientSecret);
      setTopUpPaymentIntentId(paymentIntentId);
      setTopUpAmountCents(cents);
      setTopUpModalOpen(true);
    } catch (err) {
      toast.danger("Error", { description: err instanceof Error ? err.message : "Failed to start top-up" });
    } finally {
      setIsCreatingTopUp(false);
    }
  };

  const handleAutoRefillUpdate = async (
    updates: Partial<Omit<AutoRefillSettings, "has_payment_method">>,
  ) => {
    if (!teamId) return;
    setAutoRefillSaving(true);
    try {
      const updated = await apiPlatformAPI.updateAutoRefill(teamId, updates);
      setAutoRefill(updated);
      toast.success("Auto-refill updated", { description: updates.auto_refill !== undefined });
    } catch (err) {
      toast.danger("Error", { description: err instanceof Error ? err.message : "Failed to update auto-refill" });
      fetchAutoRefill();
    } finally {
      setAutoRefillSaving(false);
    }
  };

  const closeTopUpModal = () => {
    setTopUpModalOpen(false);
    setTopUpClientSecret(null);
    setTopUpPaymentIntentId(null);
  };

  const onTopUpSuccess = () => {
    fetchWallet();
    fetchAutoRefill();
  };

  return {
    wallet,
    walletLoading,
    topUpAmount,
    setTopUpAmount,
    topUpModalOpen,
    topUpClientSecret,
    topUpPaymentIntentId,
    topUpAmountCents,
    isCreatingTopUp,
    handleTopUp,
    closeTopUpModal,
    onTopUpSuccess,
    autoRefill,
    autoRefillLoading,
    autoRefillSaving,
    handleAutoRefillUpdate,
  };
}
