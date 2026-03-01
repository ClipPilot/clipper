"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Divider,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Skeleton,
  Switch,
  Select,
  SelectItem,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import {
  apiPlatformAPI,
  type ApiKey,
  type Wallet,
  type AutoRefillSettings,
  type UsageLog,
  type ClipJobStatus,
  type FaceSwapJobStatus,
} from "@/api/apiPlatform";
import TopUpModal from "@/components/api-platform/TopUpModal";

const TOP_UP_PRESETS = [1000, 2500, 5000, 10000]; // cents

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ApiPlatformPage() {
  const [selectedTeam] = useAtom(selectedTeamAtom);

  // Wallet state
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("");

  // Top-up modal state
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpClientSecret, setTopUpClientSecret] = useState<string | null>(null);
  const [topUpPaymentIntentId, setTopUpPaymentIntentId] = useState<string | null>(null);
  const [topUpAmountCents, setTopUpAmountCents] = useState(0);
  const [isCreatingTopUp, setIsCreatingTopUp] = useState(false);

  // Keys state
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<number | null>(null);

  // Auto-refill state
  const [autoRefill, setAutoRefill] = useState<AutoRefillSettings | null>(null);
  const [autoRefillLoading, setAutoRefillLoading] = useState(true);
  const [autoRefillSaving, setAutoRefillSaving] = useState(false);

  // Usage logs state
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [usageTotal, setUsageTotal] = useState(0);
  const [usageLoading, setUsageLoading] = useState(true);

  // Created key modal
  const [createdKeyModal, setCreatedKeyModal] = useState(false);
  const [createdKeyRaw, setCreatedKeyRaw] = useState("");
  const [createdKeyName, setCreatedKeyName] = useState("");
  const [copied, setCopied] = useState(false);

  // Job result modal
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobModalLoading, setJobModalLoading] = useState(false);
  const [jobModalType, setJobModalType] = useState<"clip" | "face-swap">("clip");
  const [clipJobResult, setClipJobResult] = useState<ClipJobStatus | null>(null);
  const [faceSwapJobResult, setFaceSwapJobResult] = useState<FaceSwapJobStatus | null>(null);

  const openJobModal = async (log: UsageLog) => {
    if (!teamId || !log.metadata?.jobId) return;
    const isClip = log.endpoint.includes("/v1/clip");
    setJobModalType(isClip ? "clip" : "face-swap");
    setClipJobResult(null);
    setFaceSwapJobResult(null);
    setJobModalOpen(true);
    setJobModalLoading(true);
    try {
      if (isClip) {
        const result = await apiPlatformAPI.getClipJobStatus(teamId, String(log.metadata.jobId));
        setClipJobResult(result);
      } else {
        const result = await apiPlatformAPI.getFaceSwapJobStatus(teamId, String(log.metadata.jobId));
        setFaceSwapJobResult(result);
      }
    } catch {
      addToast({ title: "Error", description: "Failed to load job results", color: "danger" });
      setJobModalOpen(false);
    } finally {
      setJobModalLoading(false);
    }
  };

  const teamId = selectedTeam?.id;

  const fetchWallet = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await apiPlatformAPI.getWallet(teamId);
      setWallet(data);
    } catch {
      addToast({
        title: "Error",
        description: "Failed to load wallet",
        color: "danger",
      });
    } finally {
      setWalletLoading(false);
    }
  }, [teamId]);

  const fetchKeys = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await apiPlatformAPI.listKeys(teamId);
      setKeys(data.keys);
    } catch {
      addToast({
        title: "Error",
        description: "Failed to load API keys",
        color: "danger",
      });
    } finally {
      setKeysLoading(false);
    }
  }, [teamId]);

  const fetchAutoRefill = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await apiPlatformAPI.getAutoRefill(teamId);
      setAutoRefill(data);
    } catch {
      // Non-critical, don't toast
    } finally {
      setAutoRefillLoading(false);
    }
  }, [teamId]);

  const fetchUsageLogs = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await apiPlatformAPI.getUsageLogs(teamId, 20);
      setUsageLogs(data.logs);
      setUsageTotal(data.total);
    } catch {
      // Non-critical
    } finally {
      setUsageLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchWallet();
    fetchKeys();
    fetchAutoRefill();
    fetchUsageLogs();
  }, [fetchWallet, fetchKeys, fetchAutoRefill, fetchUsageLogs]);

  const handleTopUp = async () => {
    if (!teamId) return;
    const cents = Math.round(parseFloat(topUpAmount) * 100);
    if (isNaN(cents) || cents < 500) {
      addToast({
        title: "Invalid amount",
        description: "Minimum top-up is $5.00",
        color: "danger",
      });
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
      addToast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to start top-up",
        color: "danger",
      });
    } finally {
      setIsCreatingTopUp(false);
    }
  };

  const handleCreateKey = async () => {
    if (!teamId || !newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const created = await apiPlatformAPI.createKey(teamId, newKeyName.trim());
      setCreatedKeyRaw(created.key);
      setCreatedKeyName(created.name);
      setCreatedKeyModal(true);
      setNewKeyName("");
      fetchKeys();
    } catch (err) {
      addToast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to create API key",
        color: "danger",
      });
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: number) => {
    if (!teamId) return;
    setRevokingKeyId(keyId);
    try {
      await apiPlatformAPI.revokeKey(teamId, keyId);
      addToast({
        title: "Key revoked",
        description: "The API key has been permanently revoked.",
        color: "success",
      });
      fetchKeys();
    } catch (err) {
      addToast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to revoke key",
        color: "danger",
      });
    } finally {
      setRevokingKeyId(null);
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
      addToast({
        title: "Auto-refill updated",
        description: updates.auto_refill !== undefined
          ? updates.auto_refill ? "Auto-refill enabled" : "Auto-refill disabled"
          : "Settings saved",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update auto-refill",
        color: "danger",
      });
      fetchAutoRefill();
    } finally {
      setAutoRefillSaving(false);
    }
  };

  const renderCreatedKeyModal = () => (
    <Modal
      isOpen={createdKeyModal}
      onClose={() => {
        setCreatedKeyModal(false);
        setCreatedKeyRaw("");
        setCopied(false);
      }}
      size="lg"
      classNames={{
        base: "bg-surface-base border border-border-base",
        header: "border-b border-border-base",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:key-bold-duotone"
              className="text-green-500"
              width={24}
            />
            <span className="text-text-primary">API Key Created</span>
          </div>
        </ModalHeader>
        <ModalBody className="py-6 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Icon
              icon="solar:danger-triangle-bold-duotone"
              className="text-amber-500 flex-shrink-0"
              width={20}
            />
            <p className="text-sm text-amber-500">
              This key will only be shown once. Copy and store it securely.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-surface-elevated space-y-4">
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Key Name</p>
              <p className="text-text-primary font-medium">{createdKeyName}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider mb-2">API Key</p>
              <div className="flex items-start gap-2">
                <code className="flex-1 text-sm font-mono text-green-500 bg-surface-dark px-3 py-2 rounded break-all select-all">
                  {createdKeyRaw}
                </code>
                <Button
                  size="sm"
                  isIconOnly
                  variant="flat"
                  className={
                    copied
                      ? "bg-green-500/20 text-green-500"
                      : "bg-surface-dark text-text-secondary hover:text-text-primary"
                  }
                  onPress={() => {
                    navigator.clipboard.writeText(createdKeyRaw);
                    setCopied(true);
                  }}
                >
                  <Icon
                    icon={copied ? "solar:check-circle-bold-duotone" : "solar:copy-bold-duotone"}
                    width={18}
                  />
                </Button>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            className="bg-accent-400 text-white font-medium"
            onPress={() => {
              setCreatedKeyModal(false);
              setCreatedKeyRaw("");
              setCopied(false);
            }}
          >
            Done
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  const activeKeys = keys.filter((k) => !k.revoked);
  const revokedKeys = keys.filter((k) => k.revoked);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-surface-dark p-6 lg:p-8"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h1 className="text-2xl font-bold text-text-primary">API Platform</h1>
          <p className="text-text-secondary mt-1">
            Manage your API keys and wallet balance
          </p>
          <div className="flex items-center gap-3 mt-3">
            <a
              href="https://developers.cuttr.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-accent-400 hover:text-accent-300 transition-colors"
            >
              <Icon icon="solar:book-bold-duotone" width={16} />
              Documentation
              <Icon icon="solar:arrow-right-up-linear" width={14} />
            </a>
            <span className="text-border-base">|</span>
            <a
              href="https://status.cuttr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-accent-400 hover:text-accent-300 transition-colors"
            >
              <Icon icon="solar:server-bold-duotone" width={16} />
              System Status
              <Icon icon="solar:arrow-right-up-linear" width={14} />
            </a>
          </div>
        </motion.div>

        {/* Wallet Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-surface-base border border-border-base">
            <CardHeader className="flex flex-row items-center gap-3 pb-0">
              <Icon
                icon="solar:wallet-bold-duotone"
                className="text-accent-400"
                width={24}
              />
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Wallet
                </h2>
                <p className="text-sm text-text-tertiary">
                  Fund your wallet to make API calls
                </p>
              </div>
            </CardHeader>
            <CardBody className="gap-6">
              {walletLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
              ) : wallet ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-surface-elevated">
                      <p className="text-sm text-text-tertiary mb-1">Balance</p>
                      <p className="text-2xl font-bold text-green-500">
                        {formatCents(wallet.balance_cents)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-surface-elevated">
                      <p className="text-sm text-text-tertiary mb-1">
                        Total Spent
                      </p>
                      <p className="text-2xl font-bold text-text-primary">
                        {formatCents(wallet.total_spent_cents)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-surface-elevated">
                      <p className="text-sm text-text-tertiary mb-1">
                        Total Funded
                      </p>
                      <p className="text-2xl font-bold text-text-primary">
                        {formatCents(wallet.total_topped_up_cents)}
                      </p>
                    </div>
                  </div>

                  <Divider className="bg-border-base" />

                  <div>
                    <p className="text-sm font-medium text-text-secondary mb-3">
                      Add Funds
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {TOP_UP_PRESETS.map((preset) => (
                        <Button
                          key={preset}
                          size="sm"
                          variant="flat"
                          className={
                            topUpAmount === (preset / 100).toString()
                              ? "bg-accent-400/20 text-accent-400 border border-accent-400/40"
                              : "bg-surface-elevated text-text-secondary hover:text-text-primary"
                          }
                          onPress={() =>
                            setTopUpAmount((preset / 100).toString())
                          }
                        >
                          {formatCents(preset)}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <Input
                        placeholder="Amount in USD"
                        value={topUpAmount}
                        onValueChange={setTopUpAmount}
                        startContent={
                          <span className="text-text-tertiary text-sm">$</span>
                        }
                        type="number"
                        min={5}
                        step={1}
                        classNames={{
                          input: "bg-surface-elevated text-text-primary",
                          inputWrapper:
                            "bg-surface-elevated border-border-base hover:border-border-light",
                        }}
                      />
                      <Button
                        className="bg-accent-400 text-white font-medium flex-shrink-0"
                        isLoading={isCreatingTopUp}
                        onPress={handleTopUp}
                        startContent={
                          !isCreatingTopUp && (
                            <Icon icon="solar:card-bold-duotone" width={18} />
                          )
                        }
                      >
                        Top Up
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-text-tertiary">Failed to load wallet.</p>
              )}
            </CardBody>
          </Card>
        </motion.div>

        {/* Auto-Refill Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card className="bg-surface-base border border-border-base">
            <CardHeader className="flex flex-row items-center gap-3 pb-0">
              <Icon
                icon="solar:refresh-circle-bold-duotone"
                className="text-accent-400"
                width={24}
              />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-text-primary">
                  Auto-Refill
                </h2>
                <p className="text-sm text-text-tertiary">
                  Automatically top up when balance is low
                </p>
              </div>
            </CardHeader>
            <CardBody className="gap-4">
              {autoRefillLoading ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : autoRefill ? (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-surface-elevated">
                    <div>
                      <p className="text-text-primary font-medium">
                        Enable Auto-Refill
                      </p>
                      <p className="text-sm text-text-tertiary">
                        {autoRefill.has_payment_method
                          ? "Charge your saved card when balance drops below threshold"
                          : "Make a top-up first to save a payment method"}
                      </p>
                    </div>
                    <Switch
                      isSelected={autoRefill.auto_refill}
                      isDisabled={!autoRefill.has_payment_method || autoRefillSaving}
                      onValueChange={(val) =>
                        handleAutoRefillUpdate({ auto_refill: val })
                      }
                      classNames={{
                        wrapper: "group-data-[selected=true]:bg-accent-400",
                      }}
                    />
                  </div>

                  {autoRefill.auto_refill && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-text-secondary mb-2">
                          Refill when balance drops below
                        </p>
                        <Select
                          selectedKeys={[autoRefill.refill_threshold_cents.toString()]}
                          onSelectionChange={(keys) => {
                            const val = Array.from(keys)[0] as string;
                            if (val) handleAutoRefillUpdate({ refill_threshold_cents: parseInt(val) });
                          }}
                          isDisabled={autoRefillSaving}
                          classNames={{
                            trigger: "bg-surface-elevated border-border-base",
                            value: "text-text-primary",
                          }}
                        >
                          <SelectItem key="500">$5.00</SelectItem>
                          <SelectItem key="1000">$10.00</SelectItem>
                          <SelectItem key="2500">$25.00</SelectItem>
                          <SelectItem key="5000">$50.00</SelectItem>
                        </Select>
                      </div>
                      <div>
                        <p className="text-sm text-text-secondary mb-2">
                          Amount to refill
                        </p>
                        <Select
                          selectedKeys={[autoRefill.refill_amount_cents.toString()]}
                          onSelectionChange={(keys) => {
                            const val = Array.from(keys)[0] as string;
                            if (val) handleAutoRefillUpdate({ refill_amount_cents: parseInt(val) });
                          }}
                          isDisabled={autoRefillSaving}
                          classNames={{
                            trigger: "bg-surface-elevated border-border-base",
                            value: "text-text-primary",
                          }}
                        >
                          <SelectItem key="1000">$10.00</SelectItem>
                          <SelectItem key="2500">$25.00</SelectItem>
                          <SelectItem key="5000">$50.00</SelectItem>
                          <SelectItem key="10000">$100.00</SelectItem>
                        </Select>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-text-tertiary">Failed to load auto-refill settings.</p>
              )}
            </CardBody>
          </Card>
        </motion.div>

        {/* API Keys Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bg-surface-base border border-border-base">
            <CardHeader className="flex flex-row items-center gap-3 pb-0">
              <Icon
                icon="solar:key-bold-duotone"
                className="text-accent-400"
                width={24}
              />
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  API Keys
                </h2>
                <p className="text-sm text-text-tertiary">
                  Create and manage your API keys
                </p>
              </div>
            </CardHeader>
            <CardBody className="gap-6">
              {/* Create Key */}
              <div className="flex gap-3">
                <Input
                  placeholder="Key name (e.g. Production, Testing)"
                  value={newKeyName}
                  onValueChange={setNewKeyName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateKey();
                  }}
                  classNames={{
                    input: "bg-surface-elevated text-text-primary",
                    inputWrapper:
                      "bg-surface-elevated border-border-base hover:border-border-light",
                  }}
                />
                <Button
                  className="bg-accent-400 text-white font-medium flex-shrink-0"
                  isLoading={isCreatingKey}
                  isDisabled={!newKeyName.trim()}
                  onPress={handleCreateKey}
                  startContent={
                    !isCreatingKey && (
                      <Icon icon="solar:add-circle-bold-duotone" width={18} />
                    )
                  }
                >
                  Create Key
                </Button>
              </div>

              <Divider className="bg-border-base" />

              {/* Keys List */}
              {keysLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : keys.length === 0 ? (
                <div className="text-center py-8">
                  <Icon
                    icon="solar:key-bold-duotone"
                    className="text-text-tertiary mx-auto mb-3"
                    width={40}
                  />
                  <p className="text-text-secondary font-medium">
                    No API keys yet
                  </p>
                  <p className="text-sm text-text-tertiary mt-1">
                    Create your first key to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-surface-elevated"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Icon
                          icon="solar:key-bold-duotone"
                          className="text-green-500 flex-shrink-0"
                          width={20}
                        />
                        <div className="min-w-0">
                          <p className="text-text-primary font-medium truncate">
                            {key.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <code className="text-xs text-text-tertiary font-mono">
                              {key.key_prefix}...
                            </code>
                            <span className="text-text-tertiary text-xs">
                              Created{" "}
                              {new Date(key.created_at).toLocaleDateString()}
                            </span>
                            {key.last_used_at && (
                              <span className="text-text-tertiary text-xs">
                                · Last used{" "}
                                {new Date(
                                  key.last_used_at,
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Chip
                          size="sm"
                          variant="flat"
                          classNames={{
                            base: "bg-green-500/10",
                            content: "text-green-500 text-xs font-medium",
                          }}
                        >
                          Active
                        </Chip>
                        <Button
                          size="sm"
                          variant="flat"
                          className="bg-red-500/10 text-red-500 hover:bg-red-500/20"
                          isLoading={revokingKeyId === key.id}
                          onPress={() => handleRevokeKey(key.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}

                  {revokedKeys.length > 0 && (
                    <>
                      <p className="text-xs text-text-tertiary font-medium uppercase tracking-wider pt-2">
                        Revoked
                      </p>
                      {revokedKeys.map((key) => (
                        <div
                          key={key.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-surface-elevated opacity-50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon
                              icon="solar:key-bold-duotone"
                              className="text-text-tertiary flex-shrink-0"
                              width={20}
                            />
                            <div className="min-w-0">
                              <p className="text-text-primary font-medium truncate">
                                {key.name}
                              </p>
                              <code className="text-xs text-text-tertiary font-mono">
                                {key.key_prefix}...
                              </code>
                            </div>
                          </div>
                          <Chip
                            size="sm"
                            variant="flat"
                            classNames={{
                              base: "bg-red-500/10",
                              content: "text-red-500 text-xs font-medium",
                            }}
                          >
                            Revoked
                          </Chip>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>

        {/* Usage Logs Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bg-surface-base border border-border-base">
            <CardHeader className="flex flex-row items-center gap-3 pb-0">
              <Icon
                icon="solar:chart-bold-duotone"
                className="text-accent-400"
                width={24}
              />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-text-primary">
                  Recent Usage
                </h2>
                <p className="text-sm text-text-tertiary">
                  {usageTotal > 0
                    ? `${usageTotal} total requests`
                    : "API request history"}
                </p>
              </div>
            </CardHeader>
            <CardBody className="gap-4">
              {usageLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : usageLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Icon
                    icon="solar:chart-bold-duotone"
                    className="text-text-tertiary mx-auto mb-3"
                    width={40}
                  />
                  <p className="text-text-secondary font-medium">
                    No API requests yet
                  </p>
                  <p className="text-sm text-text-tertiary mt-1">
                    Usage will appear here once you start making API calls
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-base">
                        <th className="text-left text-text-tertiary font-medium py-2 px-3">
                          Time
                        </th>
                        <th className="text-left text-text-tertiary font-medium py-2 px-3">
                          Endpoint
                        </th>
                        <th className="text-left text-text-tertiary font-medium py-2 px-3">
                          Product
                        </th>
                        <th className="text-center text-text-tertiary font-medium py-2 px-3">
                          Status
                        </th>
                        <th className="text-left text-text-tertiary font-medium py-2 px-3">
                          Job ID
                        </th>
                        <th className="text-right text-text-tertiary font-medium py-2 px-3">
                          Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageLogs.reduce<UsageLog[]>((acc, log) => {
                        const jobId = log.metadata?.jobId;
                        if (jobId) {
                          const existing = acc.find((l) => l.metadata?.jobId === jobId);
                          if (existing) {
                            existing.cost_cents += log.cost_cents;
                            return acc;
                          }
                        }
                        acc.push({ ...log });
                        return acc;
                      }, []).map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-border-base/50 hover:bg-surface-elevated/50"
                        >
                          <td className="py-2.5 px-3 text-text-tertiary whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <Chip
                                size="sm"
                                variant="flat"
                                classNames={{
                                  base: "bg-surface-elevated px-1.5",
                                  content:
                                    "text-text-secondary text-xs font-mono",
                                }}
                              >
                                {log.method}
                              </Chip>
                              <span className="text-text-primary font-mono text-xs truncate max-w-[200px]">
                                {log.endpoint}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-text-secondary">
                            {log.product_slug || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Chip
                              size="sm"
                              variant="flat"
                              classNames={{
                                base:
                                  log.status_code < 400
                                    ? "bg-green-500/10"
                                    : "bg-red-500/10",
                                content:
                                  log.status_code < 400
                                    ? "text-green-500 text-xs"
                                    : "text-red-500 text-xs",
                              }}
                            >
                              {log.status_code}
                            </Chip>
                          </td>
                          <td className="py-2.5 px-3 text-text-secondary font-mono text-xs">
                            {log.metadata?.jobId ? (
                              <div className="flex items-center gap-1.5">
                                <span className="truncate max-w-[80px]" title={String(log.metadata.jobId)}>
                                  {String(log.metadata.jobId).length > 8
                                    ? `${String(log.metadata.jobId).slice(0, 8)}…`
                                    : log.metadata.jobId}
                                </span>
                                <Button
                                  size="sm"
                                  variant="light"
                                  isIconOnly
                                  className="min-w-6 w-6 h-6"
                                  onPress={() => {
                                    navigator.clipboard.writeText(String(log.metadata!.jobId));
                                    addToast({ title: "Copied", description: "Job ID copied to clipboard", color: "success" });
                                  }}
                                >
                                  <Icon icon="solar:copy-bold" width={14} className="text-text-tertiary" />
                                </Button>
                                {log.status_code < 400 && (
                                  <Button
                                    size="sm"
                                    variant="light"
                                    isIconOnly
                                    className="min-w-6 w-6 h-6"
                                    onPress={() => openJobModal(log)}
                                  >
                                    <Icon icon="solar:eye-bold" width={14} className="text-accent-400" />
                                  </Button>
                                )}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-text-primary">
                            {log.cost_cents > 0
                              ? formatCents(log.cost_cents)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {renderCreatedKeyModal()}

      <TopUpModal
        isOpen={topUpModalOpen}
        onClose={() => {
          setTopUpModalOpen(false);
          setTopUpClientSecret(null);
          setTopUpPaymentIntentId(null);
        }}
        clientSecret={topUpClientSecret}
        paymentIntentId={topUpPaymentIntentId}
        amountCents={topUpAmountCents}
        teamId={teamId!}
        onSuccess={() => {
          fetchWallet();
          fetchAutoRefill();
        }}
      />

      {/* Job Result Modal */}
      <Modal
        isOpen={jobModalOpen}
        onClose={() => setJobModalOpen(false)}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-surface-base border border-border-base",
          header: "border-b border-border-base",
          body: "py-4",
        }}
      >
        <ModalContent>
          <ModalHeader className="text-text-primary">
            {jobModalType === "clip" ? "Clip Job Results" : "Face Swap Job Results"}
          </ModalHeader>
          <ModalBody>
            {jobModalLoading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Icon icon="solar:refresh-bold-duotone" className="text-accent-400 animate-spin" width={32} />
                <p className="text-text-secondary text-sm">Loading results...</p>
              </div>
            ) : jobModalType === "clip" && clipJobResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-text-tertiary text-sm">Status:</span>
                  <Chip
                    size="sm"
                    variant="flat"
                    classNames={{
                      base: clipJobResult.status === "completed" ? "bg-green-500/10" : "bg-yellow-500/10",
                      content: clipJobResult.status === "completed" ? "text-green-500 text-xs" : "text-yellow-500 text-xs",
                    }}
                  >
                    {clipJobResult.status}
                  </Chip>
                  {clipJobResult.progress && (
                    <span className="text-text-tertiary text-xs">
                      ({clipJobResult.progress.completed}/{clipJobResult.progress.total})
                    </span>
                  )}
                </div>
                {clipJobResult.clips?.map((clip) => (
                  <Card key={clip.clip_id} className="bg-surface-elevated border border-border-base">
                    <CardBody className="gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-text-primary font-medium text-sm">
                            {clip.title || `Clip #${clip.clip_id}`}
                          </p>
                          {clip.heading && (
                            <p className="text-text-tertiary text-xs mt-0.5">{clip.heading}</p>
                          )}
                        </div>
                        <Chip
                          size="sm"
                          variant="flat"
                          classNames={{
                            base: clip.status === "completed" ? "bg-green-500/10" : "bg-red-500/10",
                            content: clip.status === "completed" ? "text-green-500 text-xs" : "text-red-500 text-xs",
                          }}
                        >
                          {clip.status}
                        </Chip>
                      </div>
                      {clip.status === "completed" && clip.download_url && (
                        <div className="space-y-2">
                          <video
                            src={clip.download_url}
                            controls
                            className="w-full max-h-[300px] rounded-lg bg-black"
                          />
                          <Button
                            size="sm"
                            variant="flat"
                            as="a"
                            href={clip.download_url}
                            target="_blank"
                            startContent={<Icon icon="solar:download-bold" width={16} />}
                          >
                            Download
                          </Button>
                        </div>
                      )}
                      {clip.status === "failed" && clip.error && (
                        <p className="text-red-500 text-xs">{clip.error}</p>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            ) : jobModalType === "face-swap" && faceSwapJobResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-text-tertiary text-sm">Status:</span>
                  <Chip
                    size="sm"
                    variant="flat"
                    classNames={{
                      base: faceSwapJobResult.status === "completed"
                        ? "bg-green-500/10"
                        : faceSwapJobResult.status === "failed"
                          ? "bg-red-500/10"
                          : "bg-yellow-500/10",
                      content: faceSwapJobResult.status === "completed"
                        ? "text-green-500 text-xs"
                        : faceSwapJobResult.status === "failed"
                          ? "text-red-500 text-xs"
                          : "text-yellow-500 text-xs",
                    }}
                  >
                    {faceSwapJobResult.status}
                  </Chip>
                </div>
                {faceSwapJobResult.status === "completed" && faceSwapJobResult.download_url && (
                  <div className="space-y-2">
                    <video
                      src={faceSwapJobResult.download_url}
                      controls
                      className="w-full max-h-[400px] rounded-lg bg-black"
                    />
                    <Button
                      size="sm"
                      variant="flat"
                      as="a"
                      href={faceSwapJobResult.download_url}
                      target="_blank"
                      startContent={<Icon icon="solar:download-bold" width={16} />}
                    >
                      Download
                    </Button>
                  </div>
                )}
                {faceSwapJobResult.status === "failed" && faceSwapJobResult.error && (
                  <p className="text-red-500 text-sm">{faceSwapJobResult.error}</p>
                )}
                {faceSwapJobResult.status === "processing" && (
                  <div className="text-center py-4">
                    <Icon icon="solar:refresh-bold-duotone" className="text-yellow-500 animate-spin mx-auto mb-2" width={24} />
                    <p className="text-text-secondary text-sm">Still processing...</p>
                  </div>
                )}
              </div>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setJobModalOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
