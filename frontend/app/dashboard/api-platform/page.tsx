"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Key } from "@heroui/react";
import {
  Input,
  Button,
  Separator,
  Chip,
  Modal,
  Skeleton,
  Switch,
  Select,
  ListBox,
  TextField,
  toast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { formatCents } from "@/lib/formatters";
import { type UsageLog } from "@/api/apiPlatform";
import TopUpModal from "@/components/api-platform/TopUpModal";
import { useApiWallet } from "@/hooks/useApiWallet";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useApiUsageLogs } from "@/hooks/useApiUsageLogs";

const TOP_UP_PRESETS = [1000, 2500, 5000, 10000]; // cents

function CopyableJobId({ jobId }: { jobId: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div
      onClick={() => {
        navigator.clipboard.writeText(jobId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 cursor-pointer group"
    >
      <span className="font-mono text-xs text-text-secondary group-hover:text-text-primary transition-colors">
        {jobId}
      </span>
      {copied ? (
        <Icon icon="solar:check-circle-bold" width={14} className="text-green-500 flex-shrink-0" />
      ) : (
        <Icon icon="solar:copy-bold" width={14} className="text-text-tertiary group-hover:text-text-primary transition-colors flex-shrink-0" />
      )}
    </div>
  );
}

export default function ApiPlatformPage() {
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const teamId = selectedTeam?.id;

  const {
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
  } = useApiWallet();

  const {
    keys,
    keysLoading,
    newKeyName,
    setNewKeyName,
    isCreatingKey,
    revokingKeyId,
    handleCreateKey,
    handleRevokeKey,
    activeKeys,
    revokedKeys,
    createdKeyModal,
    createdKeyRaw,
    createdKeyName,
    copied,
    closeCreatedKeyModal,
    copyCreatedKey,
  } = useApiKeys();

  const {
    usageLogs,
    usageTotal,
    usageLoading,
    jobModalOpen,
    jobModalLoading,
    jobModalType,
    clipJobResult,
    faceSwapJobResult,
    openJobModal,
    closeJobModal,
  } = useApiUsageLogs();

  const renderCreatedKeyModal = () => (
    <Modal>
      <Modal.Backdrop isOpen={createdKeyModal} onOpenChange={closeCreatedKeyModal}><Modal.Container><Modal.Dialog className="sm:max-w-2xl">
        <Modal.Header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:key-bold-duotone"
              className="text-green-500"
              width={24}
            />
            <span className="text-text-primary">API Key Created</span>
          </div>
        </Modal.Header>
        <Modal.Body className="py-6 gap-4">
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

          <div className="p-4 rounded-lg bg-white/[0.04] space-y-4">
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
                  variant="tertiary"
                  className={
                    copied
                      ? "bg-green-500/20 text-green-500"
                      : "bg-surface-dark text-text-secondary hover:text-text-primary"
                  }
                  onPress={copyCreatedKey}
                >
                  <Icon
                    icon={copied ? "solar:check-circle-bold-duotone" : "solar:copy-bold-duotone"}
                    width={18}
                  />
                </Button>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            className="bg-accent-400 text-white font-medium"
            onPress={closeCreatedKeyModal}
          >
            Done
          </Button>
        </Modal.Footer>
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );

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
          <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
            <div className="flex flex-row items-center gap-3 p-6 pb-0">
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
            </div>
            <div className="p-6 space-y-6">
              {walletLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
              ) : wallet ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-white/[0.04]">
                      <p className="text-sm text-text-tertiary mb-1">Balance</p>
                      <p className="text-2xl font-bold text-green-500">
                        {formatCents(wallet.balance_cents)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/[0.04]">
                      <p className="text-sm text-text-tertiary mb-1">
                        Total Spent
                      </p>
                      <p className="text-2xl font-bold text-text-primary">
                        {formatCents(wallet.total_spent_cents)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/[0.04]">
                      <p className="text-sm text-text-tertiary mb-1">
                        Total Funded
                      </p>
                      <p className="text-2xl font-bold text-text-primary">
                        {formatCents(wallet.total_topped_up_cents)}
                      </p>
                    </div>
                  </div>

                  <Separator className="bg-border-base" />

                  <div>
                    <p className="text-sm font-medium text-text-secondary mb-3">
                      Add Funds
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {TOP_UP_PRESETS.map((preset) => (
                        <Button
                          key={preset}
                          size="sm"
                          variant="tertiary"
                          className={
                            topUpAmount === (preset / 100).toString()
                              ? "bg-accent-400/20 text-accent-400 border border-accent-400/40"
                              : "bg-white/[0.04] text-text-secondary hover:text-text-primary"
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
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">$</span>
                        <TextField variant="secondary">
                          <Input
                            onChange={(e) => setTopUpAmount(e.target.value)}
                            placeholder="Amount in USD"
                            value={topUpAmount}
                            type="number"
                            min={5}
                            step={1}
                            className="pl-7"
                          />
                        </TextField>
                      </div>
                      <Button
                        className="bg-accent-400 text-white font-medium flex-shrink-0"
                        isPending={isCreatingTopUp}
                        onPress={handleTopUp}
                      >
                        {!isCreatingTopUp && (
                          <Icon icon="solar:card-bold-duotone" width={18} />
                        )}
                        Top Up
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-text-tertiary">Failed to load wallet.</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Auto-Refill Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
            <div className="flex flex-row items-center gap-3 p-6 pb-0">
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
            </div>
            <div className="p-6 space-y-4">
              {autoRefillLoading ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : autoRefill ? (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.04]">
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
                      onChange={(val) =>
                        handleAutoRefillUpdate({ auto_refill: val })
                      }
                    />
                  </div>

                  {autoRefill.auto_refill && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-text-secondary mb-2">
                          Refill when balance drops below
                        </p>
                        <Select
                          value={autoRefill.refill_threshold_cents.toString()}
                          onChange={(val: Key | null) => {
                            if (val) handleAutoRefillUpdate({ refill_threshold_cents: parseInt(val as string) });
                          }}
                          isDisabled={autoRefillSaving}
                        >
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="500" textValue="$5.00">$5.00<ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="1000" textValue="$10.00">$10.00<ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="2500" textValue="$25.00">$25.00<ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="5000" textValue="$50.00">$50.00<ListBox.ItemIndicator /></ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                      <div>
                        <p className="text-sm text-text-secondary mb-2">
                          Amount to refill
                        </p>
                        <Select
                          value={autoRefill.refill_amount_cents.toString()}
                          onChange={(val: Key | null) => {
                            if (val) handleAutoRefillUpdate({ refill_amount_cents: parseInt(val as string) });
                          }}
                          isDisabled={autoRefillSaving}
                        >
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="1000" textValue="$10.00">$10.00<ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="2500" textValue="$25.00">$25.00<ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="5000" textValue="$50.00">$50.00<ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="10000" textValue="$100.00">$100.00<ListBox.ItemIndicator /></ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-text-tertiary">Failed to load auto-refill settings.</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* API Keys Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
            <div className="flex flex-row items-center gap-3 p-6 pb-0">
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
            </div>
            <div className="p-6 space-y-6">
              <div className="flex gap-3">
                <TextField variant="secondary" className="flex-1">
                  <Input
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g. Production, Testing)"
                    value={newKeyName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateKey();
                    }}
                  />
                </TextField>
                <Button
                  className="bg-accent-400 text-white font-medium flex-shrink-0"
                  isPending={isCreatingKey}
                  isDisabled={!newKeyName.trim()}
                  onPress={handleCreateKey}
                >
                  {!isCreatingKey && (
                    <Icon icon="solar:add-circle-bold-duotone" width={18} />
                  )}
                  Create Key
                </Button>
              </div>

              <Separator className="bg-border-base" />

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
                      className="flex items-center justify-between p-4 rounded-lg bg-white/[0.04]"
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
                        <Chip size="sm" className="bg-green-500/15 text-green-500">
                          Active
                        </Chip>
                        <Button
                          size="sm"
                          variant="tertiary"
                          className="bg-red-500/10 text-red-500 hover:bg-red-500/20"
                          isPending={revokingKeyId === key.id}
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
                          className="flex items-center justify-between p-4 rounded-lg bg-white/[0.04] opacity-50"
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
                            variant="tertiary"
                          >
                            Revoked
                          </Chip>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Usage Logs Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
            <div className="flex flex-row items-center gap-3 p-6 pb-0">
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
            </div>
            <div className="p-6 space-y-4">
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
                          className="border-b border-border-base/50 hover:bg-white/[0.04]"
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
                                variant="tertiary"
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
                              variant="tertiary"
                            >
                              {log.status_code}
                            </Chip>
                          </td>
                          <td className="py-2.5 px-3 text-text-secondary font-mono text-xs">
                            {log.metadata?.jobId ? (
                              <div className="flex items-center gap-1.5">
                                <CopyableJobId jobId={String(log.metadata.jobId)} />
                                {log.status_code < 400 && (
                                  <Button
                                    size="sm"
                                    variant="tertiary"
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
            </div>
          </div>
        </motion.div>
      </div>

      {renderCreatedKeyModal()}

      <TopUpModal
        isOpen={topUpModalOpen}
        onClose={closeTopUpModal}
        clientSecret={topUpClientSecret}
        paymentIntentId={topUpPaymentIntentId}
        amountCents={topUpAmountCents}
        teamId={teamId!}
        onSuccess={onTopUpSuccess}
      />

      {/* Job Result Modal */}
      <Modal>
        <Modal.Backdrop isOpen={jobModalOpen} onOpenChange={closeJobModal}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
              <Modal.CloseTrigger />
              {jobModalLoading ? (
                <div className="flex flex-col items-center justify-center gap-4 py-16">
                  <div className="w-12 h-12 rounded-full bg-accent-400/10 flex items-center justify-center">
                    <Icon icon="solar:refresh-bold-duotone" className="text-accent-400 animate-spin" width={24} />
                  </div>
                  <p className="text-text-secondary text-sm">Loading results...</p>
                </div>
              ) : jobModalType === "clip" && clipJobResult ? (
                <>
                  <div className="p-6 pb-4">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-9 h-9 rounded-xl bg-accent-400/15 flex items-center justify-center">
                        <Icon icon="solar:clapperboard-edit-bold-duotone" className="text-accent-400" width={20} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-text-primary">Clip Job Results</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${clipJobResult.status === "completed" ? "text-green-500" : "text-yellow-500"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${clipJobResult.status === "completed" ? "bg-green-500" : "bg-yellow-500"}`} />
                            {clipJobResult.status}
                          </span>
                          {clipJobResult.progress && (
                            <span className="text-xs text-text-tertiary">{clipJobResult.progress.completed}/{clipJobResult.progress.total} clips</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 pb-6 space-y-2 max-h-[60vh] overflow-y-auto">
                    {clipJobResult.clips?.map((clip) => (
                      <div key={clip.clip_id} className="rounded-lg bg-white/[0.04] p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{clip.title || `Clip #${clip.clip_id}`}</p>
                            {clip.heading && <p className="text-xs text-text-tertiary mt-0.5 truncate">{clip.heading}</p>}
                          </div>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium flex-shrink-0 ${clip.status === "completed" ? "text-green-500" : "text-red-400"}`}>
                            <Icon icon={clip.status === "completed" ? "solar:check-circle-bold" : "solar:close-circle-bold"} width={14} />
                            {clip.status}
                          </span>
                        </div>
                        {clip.status === "completed" && clip.download_url && (
                          <div className="space-y-3">
                            <video src={clip.download_url} controls className="w-full max-h-[250px] rounded-lg bg-black" />
                            <a href={clip.download_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                              <Button size="sm" variant="secondary">
                                <Icon icon="solar:download-bold" width={14} />
                                Download
                              </Button>
                            </a>
                          </div>
                        )}
                        {clip.status === "failed" && clip.error && (
                          <p className="text-red-400 text-xs mt-1">{clip.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : jobModalType === "face-swap" && faceSwapJobResult ? (
                <div className="p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
                      <Icon icon="solar:mask-happly-bold-duotone" className="text-purple-400" width={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-text-primary">Face Swap Results</h3>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium mt-0.5 ${faceSwapJobResult.status === "completed" ? "text-green-500" : faceSwapJobResult.status === "failed" ? "text-red-400" : "text-yellow-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${faceSwapJobResult.status === "completed" ? "bg-green-500" : faceSwapJobResult.status === "failed" ? "bg-red-400" : "bg-yellow-500"}`} />
                        {faceSwapJobResult.status}
                      </span>
                    </div>
                  </div>
                  {faceSwapJobResult.status === "completed" && faceSwapJobResult.download_url && (
                    <div className="space-y-3">
                      <video src={faceSwapJobResult.download_url} controls className="w-full max-h-[250px] rounded-lg bg-black" />
                      <a href={faceSwapJobResult.download_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                        <Button size="sm" variant="secondary">
                          <Icon icon="solar:download-bold" width={14} />
                          Download
                        </Button>
                      </a>
                    </div>
                  )}
                  {faceSwapJobResult.status === "failed" && faceSwapJobResult.error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400 text-sm">{faceSwapJobResult.error}</p>
                    </div>
                  )}
                  {faceSwapJobResult.status === "processing" && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <Icon icon="solar:refresh-bold-duotone" className="text-yellow-400 animate-spin" width={24} />
                      <p className="text-text-secondary text-sm">Still processing...</p>
                    </div>
                  )}
                </div>
              ) : null}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </motion.div>
  );
}
