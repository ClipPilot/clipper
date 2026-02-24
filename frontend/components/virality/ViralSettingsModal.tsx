"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalFooter,
  Button,
  Input,
  Switch,
  Tabs,
  Tab,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ViralityAccount } from "@/api/virality";

const PLATFORM_ICONS: Record<string, { icon: string; color: string }> = {
  instagram: { icon: "ri:instagram-fill", color: "text-pink-500" },
  tiktok: { icon: "ri:tiktok-fill", color: "text-cyan-500" },
  x: { icon: "ri:twitter-x-fill", color: "text-foreground" },
};

type TimeFrame = "12" | "24" | "48";
type ThresholdMode = "and" | "or";

export interface ViralSettings {
  enabledAccountIds: number[];
  percentThreshold: number | null;
  absoluteThreshold: number | null;
  thresholdMode: ThresholdMode;
  timeFrameHours: TimeFrame;
}

interface ViralSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: ViralityAccount[];
  settings: ViralSettings;
  onSave: (settings: ViralSettings) => void;
}

const DEFAULT_SETTINGS: ViralSettings = {
  enabledAccountIds: [],
  percentThreshold: 200,
  absoluteThreshold: null,
  thresholdMode: "or",
  timeFrameHours: "24",
};

export { DEFAULT_SETTINGS as defaultViralSettings };

export function ViralSettingsModal({
  isOpen,
  onClose,
  accounts,
  settings,
  onSave,
}: ViralSettingsModalProps) {
  const [enabledIds, setEnabledIds] = useState<number[]>(settings.enabledAccountIds);
  const [usePercent, setUsePercent] = useState(settings.percentThreshold !== null);
  const [percentValue, setPercentValue] = useState(String(settings.percentThreshold ?? 200));
  const [useAbsolute, setUseAbsolute] = useState(settings.absoluteThreshold !== null);
  const [absoluteValue, setAbsoluteValue] = useState(String(settings.absoluteThreshold ?? 10000));
  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>(settings.thresholdMode);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(
    (["12", "24", "48"] as TimeFrame[]).includes(settings.timeFrameHours as TimeFrame)
      ? (settings.timeFrameHours as TimeFrame)
      : "12"
  );

  const toggleAccount = (id: number) => {
    setEnabledIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (enabledIds.length === accounts.length) {
      setEnabledIds([]);
    } else {
      setEnabledIds(accounts.map((a) => a.id));
    }
  };

  const handleSave = () => {
    onSave({
      enabledAccountIds: enabledIds,
      percentThreshold: usePercent ? Number(percentValue) || null : null,
      absoluteThreshold: useAbsolute ? Number(absoluteValue) || null : null,
      thresholdMode,
      timeFrameHours: timeFrame,
    });
    onClose();
  };

  const handleClose = () => {
    setEnabledIds(settings.enabledAccountIds);
    setUsePercent(settings.percentThreshold !== null);
    setPercentValue(String(settings.percentThreshold ?? 200));
    setUseAbsolute(settings.absoluteThreshold !== null);
    setAbsoluteValue(String(settings.absoluteThreshold ?? 10000));
    setThresholdMode(settings.thresholdMode);
    setTimeFrame(
      (["12", "24", "48"] as TimeFrame[]).includes(settings.timeFrameHours as TimeFrame)
        ? (settings.timeFrameHours as TimeFrame)
        : "12"
    );
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="full"
      hideCloseButton
      scrollBehavior="inside"
      classNames={{
        base: "bg-[#1a1d2e] m-0 sm:m-0 rounded-none h-full max-h-full",
        body: "p-0",
        header: "p-0",
        footer: "p-0",
      }}
    >
      <ModalContent className="h-full flex flex-col">
        {/* Sticky header */}
        <ModalHeader className="flex-shrink-0 border-b border-[#2a2d3e] px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-400/10 rounded-lg">
                <Icon icon="solar:settings-bold" width={20} className="text-accent-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Viral Alert Settings</h2>
                <p className="text-xs text-gray-400 font-normal">
                  Define what &quot;going viral&quot; means for your accounts
                </p>
              </div>
            </div>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={handleClose}
              className="text-gray-400 hover:text-white"
            >
              <Icon icon="solar:close-circle-linear" width={24} />
            </Button>
          </div>
        </ModalHeader>

        {/* Scrollable body */}
        <ModalBody className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl mx-auto w-full space-y-8">
            {/* ── Account Selection ── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:users-group-rounded-bold" width={18} className="text-accent-400" />
                  <h3 className="text-sm font-semibold text-white">Accounts to Monitor</h3>
                </div>
                <button
                  onClick={toggleAll}
                  className="text-xs text-accent-400 hover:text-accent-300 transition-colors"
                >
                  {enabledIds.length === accounts.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Choose which accounts should trigger viral alerts
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl bg-[#0d0f1a] border border-[#2a2d3e] p-2">
                {accounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Icon icon="solar:users-group-rounded-linear" width={32} className="text-gray-600 mb-2" />
                    <p className="text-gray-500 text-sm">No accounts added yet</p>
                  </div>
                ) : (
                  accounts.map((account) => {
                    const selected = enabledIds.includes(account.id);
                    const platform = PLATFORM_ICONS[account.platform] ?? PLATFORM_ICONS.instagram;
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => toggleAccount(account.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                          selected
                            ? "bg-accent-400/10"
                            : "hover:bg-[#1a1d2e]"
                        }`}
                      >
                        <Icon icon={platform.icon} width={18} className={platform.color} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">@{account.username}</p>
                          <p className="text-[11px] text-gray-500 capitalize">{account.platform}</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                            selected ? "bg-accent-400" : "border border-[#3a3d4e]"
                          }`}
                        >
                          {selected && (
                            <Icon icon="solar:check-read-linear" width={12} className="text-white" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {accounts.length > 0 && (
                <p className="text-[11px] text-gray-500">
                  {enabledIds.length} of {accounts.length} accounts selected
                </p>
              )}
            </section>

            {/* ── Divider ── */}
            <div className="border-t border-[#2a2d3e]" />

            {/* ── Viral Threshold ── */}
            <section className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Icon icon="solar:fire-bold" width={18} className="text-orange-400" />
                  <h3 className="text-sm font-semibold text-white">Viral Threshold</h3>
                </div>
                <p className="text-xs text-gray-500">
                  Set the criteria that define a post as &quot;viral&quot;. Enable one or both conditions.
                </p>
              </div>

              {/* Percent increase */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  usePercent ? "bg-[#0d0f1a] border-accent-400/30" : "bg-[#0d0f1a] border-[#2a2d3e]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-green-500/10">
                      <Icon icon="solar:graph-up-bold" width={16} className="text-green-400" />
                    </div>
                    <div>
                      <span className="text-sm text-white">% Increase in Views</span>
                      <p className="text-[11px] text-gray-500">Percentage growth over the detection window</p>
                    </div>
                  </div>
                  <Switch
                    size="sm"
                    isSelected={usePercent}
                    onValueChange={setUsePercent}
                    classNames={{ wrapper: usePercent ? "bg-accent-400" : "bg-gray-600" }}
                  />
                </div>
                {usePercent && (
                  <div className="flex items-center gap-3 mt-4 ml-10">
                    <Input
                      type="number"
                      size="sm"
                      value={percentValue}
                      onValueChange={setPercentValue}
                      endContent={<span className="text-gray-500 text-xs">%</span>}
                      classNames={{
                        base: "max-w-[120px]",
                        inputWrapper:
                          "bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg h-9",
                        input: "text-white text-sm",
                      }}
                    />
                    <span className="text-xs text-gray-400">increase triggers alert</span>
                  </div>
                )}
              </div>

              {/* AND / OR toggle — only shown when both thresholds are enabled */}
              {usePercent && useAbsolute && (
                <div className="flex items-center justify-center gap-2">
                  <div className="flex-1 border-t border-[#2a2d3e]" />
                  <div className="flex items-center bg-[#0d0f1a] border border-[#2a2d3e] rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setThresholdMode("and")}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        thresholdMode === "and"
                          ? "bg-accent-400 text-white"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      onClick={() => setThresholdMode("or")}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        thresholdMode === "or"
                          ? "bg-accent-400 text-white"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                    >
                      OR
                    </button>
                  </div>
                  <div className="flex-1 border-t border-[#2a2d3e]" />
                </div>
              )}

              {/* Absolute change */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  useAbsolute ? "bg-[#0d0f1a] border-accent-400/30" : "bg-[#0d0f1a] border-[#2a2d3e]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <Icon icon="solar:graph-new-up-bold" width={16} className="text-blue-400" />
                    </div>
                    <div>
                      <span className="text-sm text-white">Absolute Change in Views</span>
                      <p className="text-[11px] text-gray-500">Raw view count jump over the detection window</p>
                    </div>
                  </div>
                  <Switch
                    size="sm"
                    isSelected={useAbsolute}
                    onValueChange={setUseAbsolute}
                    classNames={{ wrapper: useAbsolute ? "bg-accent-400" : "bg-gray-600" }}
                  />
                </div>
                {useAbsolute && (
                  <div className="flex items-center gap-3 mt-4 ml-10">
                    <Input
                      type="number"
                      size="sm"
                      value={absoluteValue}
                      onValueChange={setAbsoluteValue}
                      startContent={<span className="text-gray-500 text-xs">+</span>}
                      classNames={{
                        base: "max-w-[140px]",
                        inputWrapper:
                          "bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg h-9",
                        input: "text-white text-sm",
                      }}
                    />
                    <span className="text-xs text-gray-400">views triggers alert</span>
                  </div>
                )}
              </div>

              {!usePercent && !useAbsolute && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <Icon icon="solar:danger-triangle-bold" width={14} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">
                    Enable at least one threshold to receive viral alerts
                  </p>
                </div>
              )}
            </section>

            {/* ── Divider ── */}
            <div className="border-t border-[#2a2d3e]" />

            {/* ── Detection Window ── */}
            <section className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Icon icon="solar:clock-circle-bold" width={18} className="text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">Detection Window</h3>
                </div>
                <p className="text-xs text-gray-500">
                  How far back to look when calculating view changes
                </p>
              </div>
              <Tabs
                selectedKey={timeFrame}
                onSelectionChange={(key) => setTimeFrame(key as TimeFrame)}
                variant="solid"
                fullWidth
                classNames={{
                  tabList:
                    "bg-[#0d0f1a] border border-[#2a2d3e] rounded-xl p-1 gap-1",
                  tab: "rounded-lg h-10 text-sm",
                  cursor: "bg-accent-400 rounded-lg",
                }}
              >
                <Tab key="12" title="12 hours" />
                <Tab key="24" title="24 hours" />
                <Tab key="48" title="48 hours" />
              </Tabs>
            </section>
          </div>
        </ModalBody>

        {/* Sticky footer */}
        <ModalFooter className="flex-shrink-0 border-t border-[#2a2d3e] px-6 py-4">
          <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
            <Button
              variant="flat"
              className="bg-[#0d0f1a] text-gray-400 border border-[#2a2d3e]"
              onPress={handleClose}
            >
              Cancel
            </Button>
            <Button
              className="bg-accent-400 text-white font-semibold px-8"
              onPress={handleSave}
              isDisabled={enabledIds.length === 0 || (!usePercent && !useAbsolute)}
            >
              Save Settings
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
