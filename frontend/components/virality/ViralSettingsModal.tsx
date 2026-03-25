"use client";

import { useState } from "react";
import { Modal,
  Button,
  Input,
  Switch,
  Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { CompetitorWithAccounts } from "@/api/virality";

const PLATFORM_ICONS: Record<string, { icon: string; color: string }> = {
  instagram: { icon: "ri:instagram-fill", color: "text-pink-500" },
  tiktok: { icon: "ri:tiktok-fill", color: "text-cyan-500" },
  x: { icon: "ri:twitter-x-fill", color: "text-foreground" },
};

type TimeFrame = "12" | "24" | "48";
type ThresholdMode = "and" | "or";
type AccountView = "account" | "competitor";

export interface ViralSettingsModalData {
  enabledAccountIds: number[];
  percentThreshold: number | null;
  absoluteThreshold: number | null;
  thresholdMode: ThresholdMode;
  timeFrameHours: number;
  additionalEmails: string[];
}

interface ViralSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitors: CompetitorWithAccounts[];
  settings: ViralSettingsModalData;
  onSave: (settings: ViralSettingsModalData) => void;
}

const DEFAULT_SETTINGS: ViralSettingsModalData = {
  enabledAccountIds: [],
  percentThreshold: 200,
  absoluteThreshold: null,
  thresholdMode: "or",
  timeFrameHours: 24,
  additionalEmails: [],
};

export { DEFAULT_SETTINGS as defaultViralSettings };

export function ViralSettingsModal({
  isOpen,
  onClose,
  competitors,
  settings,
  onSave,
}: ViralSettingsModalProps) {
  const accounts = competitors.flatMap((c) => c.accounts);
  const [enabledIds, setEnabledIds] = useState<number[]>(settings.enabledAccountIds);
  const [accountView, setAccountView] = useState<AccountView>("account");
  const [usePercent, setUsePercent] = useState(settings.percentThreshold !== null);
  const [percentValue, setPercentValue] = useState(String(settings.percentThreshold ?? 200));
  const [useAbsolute, setUseAbsolute] = useState(settings.absoluteThreshold !== null);
  const [absoluteValue, setAbsoluteValue] = useState(String(settings.absoluteThreshold ?? 10000));
  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>(settings.thresholdMode);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(
    (["12", "24", "48"] as TimeFrame[]).includes(String(settings.timeFrameHours) as TimeFrame)
      ? (String(settings.timeFrameHours) as TimeFrame)
      : "24"
  );
  const [additionalEmails, setAdditionalEmails] = useState<string[]>(settings.additionalEmails ?? []);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const addEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!emailRegex.test(trimmed)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    if (additionalEmails.includes(trimmed)) {
      setEmailError("This email has already been added");
      return;
    }
    if (additionalEmails.length >= 10) {
      setEmailError("Maximum 10 additional emails allowed");
      return;
    }
    setAdditionalEmails([...additionalEmails, trimmed]);
    setNewEmail("");
    setEmailError("");
  };

  const removeEmail = (email: string) => {
    setAdditionalEmails(additionalEmails.filter((e) => e !== email));
  };

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

  const toggleCompetitor = (competitor: CompetitorWithAccounts) => {
    const compAccountIds = competitor.accounts.map((a) => a.id);
    const allSelected = compAccountIds.every((id) => enabledIds.includes(id));
    if (allSelected) {
      setEnabledIds((prev) => prev.filter((id) => !compAccountIds.includes(id)));
    } else {
      setEnabledIds((prev) => Array.from(new Set([...prev, ...compAccountIds])));
    }
  };

  const handleSave = () => {
    onSave({
      enabledAccountIds: enabledIds,
      percentThreshold: usePercent ? Number(percentValue) || null : null,
      absoluteThreshold: useAbsolute ? Number(absoluteValue) || null : null,
      thresholdMode,
      timeFrameHours: parseInt(timeFrame),
      additionalEmails,
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
      (["12", "24", "48"] as TimeFrame[]).includes(String(settings.timeFrameHours) as TimeFrame)
        ? (String(settings.timeFrameHours) as TimeFrame)
        : "24"
    );
    setAdditionalEmails(settings.additionalEmails ?? []);
    setNewEmail("");
    setEmailError("");
    onClose();
  };

  return (
    <Modal
 hideCloseButton>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose}><Modal.Container scroll="inside"><Modal.Dialog className="max-w-full h-full h-full flex flex-col">
        {/* Sticky header */}
        <Modal.Header className="flex-shrink-0 border-b border-[#2a2d3e] px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-400/10 rounded-lg">
                <Icon icon="solar:settings-bold" width={20} className="text-accent-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Viral Alert Settings</h2>
                <p className="text-xs text-gray-400 font-normal">
                  Add the emails you’d like to receive virality alerts to, and adjust the alert settings below
                </p>
              </div>
            </div>
            <Button
 isIconOnly
 variant="tertiary"
 size="sm"
 onPress={handleClose}
 className="text-gray-400 hover:text-white"
 >
              <Icon icon="solar:close-circle-linear" width={24} />
            </Button>
          </div>
        </Modal.Header>

        {/* Scrollable body */}
        <Modal.Body className="flex-1 overflow-y-auto px-6 py-6">
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

              {/* View toggle */}
              <div className="flex items-center bg-[#0d0f1a] border border-[#2a2d3e] rounded-lg p-0.5 w-fit">
                <button
                  type="button"
                  onClick={() => setAccountView("account")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    accountView === "account"
                      ? "bg-accent-400 text-white"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  By Account
                </button>
                <button
                  type="button"
                  onClick={() => setAccountView("competitor")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    accountView === "competitor"
                      ? "bg-accent-400 text-white"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  By Competitor
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-xl bg-[#0d0f1a] border border-[#2a2d3e] p-2">
                {accounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Icon icon="solar:users-group-rounded-linear" width={32} className="text-gray-600 mb-2" />
                    <p className="text-gray-500 text-sm">No accounts added yet</p>
                  </div>
                ) : accountView === "account" ? (
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
                ) : (
                  competitors.map((comp) => {
                    const compAccountIds = comp.accounts.map((a) => a.id);
                    const selectedCount = compAccountIds.filter((id) => enabledIds.includes(id)).length;
                    const allSelected = compAccountIds.length > 0 && selectedCount === compAccountIds.length;
                    const someSelected = selectedCount > 0 && !allSelected;
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => toggleCompetitor(comp)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                          allSelected
                            ? "bg-accent-400/10"
                            : someSelected
                              ? "bg-accent-400/5"
                              : "hover:bg-[#1a1d2e]"
                        }`}
                      >
                        <Icon icon="solar:users-group-two-rounded-bold" width={18} className="text-accent-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{comp.name}</p>
                          <p className="text-[11px] text-gray-500">
                            {comp.accounts.length} account{comp.accounts.length !== 1 ? "s" : ""}
                            {someSelected || allSelected ? ` \u00B7 ${selectedCount} selected` : ""}
                          </p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                            allSelected
                              ? "bg-accent-400"
                              : someSelected
                                ? "bg-accent-400/50"
                                : "border border-[#3a3d4e]"
                          }`}
                        >
                          {(allSelected || someSelected) && (
                            <Icon
                              icon={allSelected ? "solar:check-read-linear" : "solar:minus-linear"}
                              width={12}
                              className="text-white"
                            />
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
 isSelected={usePercent}
 onChange={setUsePercent}
 />
                </div>
                {usePercent && (
                  <div className="flex items-center gap-3 mt-4 ml-10">
                    <Input onChange={(e) => (setPercentValue)(e.target.value)}
 type="number"
 value={percentValue}
 endContent={<span className="text-gray-500 text-xs">%</span>}
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
 isSelected={useAbsolute}
 onChange={setUseAbsolute}
 />
                </div>
                {useAbsolute && (
                  <div className="flex items-center gap-3 mt-4 ml-10">
                    <Input onChange={(e) => (setAbsoluteValue)(e.target.value)}
 type="number"
 value={absoluteValue}
 startContent={<span className="text-gray-500 text-xs">+</span>}
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
 >
                <Tab key="12" title="12 hours" />
                <Tab key="24" title="24 hours" />
                <Tab key="48" title="48 hours" />
              </Tabs>
            </section>

            {/* ── Divider ── */}
            <div className="border-t border-[#2a2d3e]" />

            {/* ── Additional Alert Emails ── */}
            <section className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Icon icon="solar:letter-bold" width={18} className="text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Additional Alert Emails</h3>
                </div>
                <p className="text-xs text-gray-500">
                  Send viral alerts to people outside your team (max 10)
                </p>
              </div>

              <div className="flex gap-2">
                <Input onChange={(e) => ((v) => { setNewEmail(v); setEmailError(""); })(e.target.value)}
 type="email"
 placeholder="email@example.com"
 value={newEmail}
 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
 isInvalid={!!emailError}
 errorMessage={emailError}
 />
                <Button
 size="sm"
 className="bg-accent-400 text-white font-semibold h-9 px-4"
 onPress={addEmail}
 isDisabled={!newEmail.trim() || additionalEmails.length >= 10}
 >
                  Add
                </Button>
              </div>

              {additionalEmails.length > 0 && (
                <div className="space-y-1.5 rounded-xl bg-[#0d0f1a] border border-[#2a2d3e] p-2">
                  {additionalEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#1a1d2e] transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:letter-linear" width={14} className="text-gray-500" />
                        <span className="text-sm text-white">{email}</span>
                      </div>
                      <Button
 isIconOnly
 variant="tertiary"
 size="sm"
 onPress={() => removeEmail(email)}
 className="text-gray-500 hover:text-red-400 min-w-6 w-6 h-6"
 >
                        <Icon icon="solar:close-circle-linear" width={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {additionalEmails.length > 0 && (
                <p className="text-[11px] text-gray-500">
                  {additionalEmails.length} of 10 additional emails configured
                </p>
              )}
            </section>
          </div>
        </Modal.Body>

        {/* Sticky footer */}
        <Modal.Footer className="flex-shrink-0 border-t border-[#2a2d3e] px-6 py-4">
          <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
            <Button
 variant="tertiary"
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
        </Modal.Footer>
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
}
