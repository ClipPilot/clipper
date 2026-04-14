"use client";

import { useState } from "react";
import { Button, Switch, SwitchControl, SwitchThumb, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

interface ViralSettingsData {
  owned_percent_threshold: number;
  owned_absolute_threshold: number;
  owned_threshold_mode: "and" | "or";
  owned_alerts_enabled: boolean;
  competitor_percent_threshold: number;
  competitor_absolute_threshold: number;
  competitor_threshold_mode: "and" | "or";
  competitor_alerts_enabled: boolean;
  time_frame_hours: number;
  additional_emails: string[];
}

interface SavePayload {
  ownedPercentThreshold: number;
  ownedAbsoluteThreshold: number;
  ownedThresholdMode: "and" | "or";
  ownedAlertsEnabled: boolean;
  competitorPercentThreshold: number;
  competitorAbsoluteThreshold: number;
  competitorThresholdMode: "and" | "or";
  competitorAlertsEnabled: boolean;
}

export interface AlertConfigPanelProps {
  settings: ViralSettingsData;
  onSave: (updates: SavePayload) => Promise<void>;
}

type CardField = "percentThreshold" | "absoluteThreshold" | "thresholdMode" | "enabled";

interface CardState {
  percentThreshold: number;
  absoluteThreshold: number;
  thresholdMode: "and" | "or";
  enabled: boolean;
}

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <span className="cursor-help">
          <Icon icon="solar:info-circle-linear" width={13} className="text-text-tertiary" />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content>{text}</Tooltip.Content>
    </Tooltip>
  );
}

function ThresholdCard({
  label,
  description,
  percentThreshold,
  absoluteThreshold,
  thresholdMode,
  enabled,
  onChange,
}: CardState & {
  label: string;
  description: string;
  onChange: (field: CardField, value: number | boolean | "and" | "or") => void;
}) {
  return (
    <div className="glass-inner rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold tracking-widest uppercase text-accent-400">{label}</p>
        <Switch isSelected={enabled} onChange={(v: boolean) => onChange("enabled", v)} size="sm">
          <SwitchControl><SwitchThumb /></SwitchControl>
        </Switch>
      </div>
      <p className="text-[10px] text-text-tertiary mb-3">{description}</p>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-secondary">Growth threshold</span>
            <InfoTip text="Minimum percentage increase in views to trigger an alert. Higher = fewer, more significant alerts." />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={percentThreshold}
              onChange={(e) => onChange("percentThreshold", Number(e.target.value))}
              className="w-20 text-right rounded-lg px-2.5 py-1 text-xs text-text-primary tabular-nums bg-surface-base border border-border-base"
            />
            <span className="text-xs text-text-tertiary">%</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-secondary">Min views gained</span>
            <InfoTip text="Minimum absolute view increase to trigger an alert. Prevents alerts on small accounts with high % but low total views." />
          </div>
          <input
            type="number"
            value={absoluteThreshold}
            onChange={(e) => onChange("absoluteThreshold", Number(e.target.value))}
            className="w-24 text-right rounded-lg px-2.5 py-1 text-xs text-text-primary tabular-nums bg-surface-base border border-border-base"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-secondary">Mode</span>
            <InfoTip text="AND = both conditions must be met. OR = either condition triggers an alert." />
          </div>
          <select
            value={thresholdMode}
            onChange={(e) => onChange("thresholdMode", e.target.value as "and" | "or")}
            className="rounded-lg px-2.5 py-1 text-xs text-text-primary bg-surface-base border border-border-base"
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export function AlertConfigPanel({ settings, onSave }: AlertConfigPanelProps) {
  const [owned, setOwned] = useState<CardState>({
    percentThreshold: settings.owned_percent_threshold,
    absoluteThreshold: settings.owned_absolute_threshold,
    thresholdMode: settings.owned_threshold_mode,
    enabled: settings.owned_alerts_enabled,
  });
  const [competitor, setCompetitor] = useState<CardState>({
    percentThreshold: settings.competitor_percent_threshold,
    absoluteThreshold: settings.competitor_absolute_threshold,
    thresholdMode: settings.competitor_threshold_mode,
    enabled: settings.competitor_alerts_enabled,
  });
  const [saving, setSaving] = useState(false);

  function patchOwned(field: CardField, value: number | boolean | "and" | "or") {
    setOwned((prev) => ({ ...prev, [field]: value }));
  }

  function patchCompetitor(field: CardField, value: number | boolean | "and" | "or") {
    setCompetitor((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        ownedPercentThreshold: owned.percentThreshold,
        ownedAbsoluteThreshold: owned.absoluteThreshold,
        ownedThresholdMode: owned.thresholdMode,
        ownedAlertsEnabled: owned.enabled,
        competitorPercentThreshold: competitor.percentThreshold,
        competitorAbsoluteThreshold: competitor.absoluteThreshold,
        competitorThresholdMode: competitor.thresholdMode,
        competitorAlertsEnabled: competitor.enabled,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-text-primary">Alert Configuration</p>
            <InfoTip text="Configure thresholds for viral post detection. Separate thresholds for your own accounts vs competitors." />
          </div>
          <p className="text-xs text-text-tertiary mt-0.5">Thresholds apply to the next sync cycle</p>
        </div>
        <Button
          size="sm"
          className="bg-accent-400 text-white"
          isPending={saving}
          onPress={handleSave}
        >
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <ThresholdCard
          label="Your Accounts"
          description="Alert when your own posts go viral"
          percentThreshold={owned.percentThreshold}
          absoluteThreshold={owned.absoluteThreshold}
          thresholdMode={owned.thresholdMode}
          enabled={owned.enabled}
          onChange={patchOwned}
        />
        <ThresholdCard
          label="Competitors"
          description="Alert when competitor posts go viral"
          percentThreshold={competitor.percentThreshold}
          absoluteThreshold={competitor.absoluteThreshold}
          thresholdMode={competitor.thresholdMode}
          enabled={competitor.enabled}
          onChange={patchCompetitor}
        />
      </div>

      <div className="flex items-center gap-6 pt-4 border-t border-border-base">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-tertiary">Detection window</span>
          <InfoTip text="Time period for measuring view growth. Shorter = faster detection, longer = fewer false positives." />
          <span className="text-xs font-semibold text-accent-400">{settings.time_frame_hours}h</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-tertiary">Additional recipients</span>
          <InfoTip text="Extra email addresses that receive alert notifications beyond your team members." />
          <span className="text-xs font-semibold text-accent-400">{settings.additional_emails.length} emails</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-text-tertiary">Debounce: 12h</span>
          <InfoTip text="Same post will not re-trigger an alert within 12 hours, preventing duplicate notifications." />
        </div>
      </div>
    </div>
  );
}
