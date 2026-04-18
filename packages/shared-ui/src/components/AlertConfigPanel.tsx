"use client";

import { useState } from "react";
import { Button, Switch, SwitchControl, SwitchThumb, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SegmentedControl } from "./SegmentedControl";

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

function GroupRow({
  label,
  tip,
  children,
  isLast,
}: {
  label: string;
  tip?: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 ${isLast ? "" : "border-b border-white/[0.06] dark:border-white/[0.06]"}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[13px] text-text-secondary">{label}</span>
        {tip && <InfoTip text={tip} />}
      </div>
      {children}
    </div>
  );
}

function ThresholdGroup({
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
    <div className="space-y-2">
      <div className="flex items-baseline justify-between px-1.5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-text-primary">{label}</p>
          <p className="text-[11px] text-text-tertiary mt-0.5">{description}</p>
        </div>
        <Switch isSelected={enabled} onChange={(v: boolean) => onChange("enabled", v)} size="sm">
          <SwitchControl><SwitchThumb /></SwitchControl>
        </Switch>
      </div>

      <div className="liquid-glass rounded-2xl overflow-hidden">
        <GroupRow
          label="Growth threshold"
          tip="Minimum percentage increase in views to trigger an alert."
        >
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={percentThreshold}
              onChange={(e) => onChange("percentThreshold", Number(e.target.value))}
              className="w-20 text-right rounded-lg px-2.5 py-1 text-[13px] text-text-primary tabular-nums bg-white/[0.06] border border-white/[0.08] focus:outline-none focus:border-accent-400/40 transition"
            />
            <span className="text-[12px] text-text-tertiary">%</span>
          </div>
        </GroupRow>
        <GroupRow
          label="Min views gained"
          tip="Minimum absolute view increase to trigger an alert."
        >
          <input
            type="number"
            value={absoluteThreshold}
            onChange={(e) => onChange("absoluteThreshold", Number(e.target.value))}
            className="w-24 text-right rounded-lg px-2.5 py-1 text-[13px] text-text-primary tabular-nums bg-white/[0.06] border border-white/[0.08] focus:outline-none focus:border-accent-400/40 transition"
          />
        </GroupRow>
        <GroupRow
          label="Mode"
          tip="AND = both conditions must be met. OR = either condition triggers."
          isLast
        >
          <SegmentedControl<"and" | "or">
            value={thresholdMode}
            onChange={(v) => onChange("thresholdMode", v)}
            options={[
              { value: "and", label: "AND" },
              { value: "or", label: "OR" },
            ]}
          />
        </GroupRow>
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
    <div className="space-y-5">
      <div className="flex items-end justify-between px-1.5">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[15px] font-semibold text-text-primary">Alert Configuration</p>
            <InfoTip text="Configure thresholds for viral post detection." />
          </div>
          <p className="text-[12px] text-text-tertiary mt-0.5">Thresholds apply to the next sync cycle</p>
        </div>
        <Button
          size="sm"
          className="bg-accent-400/90 hover:bg-accent-400 text-white rounded-full shadow-lg shadow-accent-400/20 backdrop-blur-xl border border-white/[0.12]"
          isPending={saving}
          onPress={handleSave}
        >
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ThresholdGroup
          label="Your Accounts"
          description="Alert when your own posts go viral"
          percentThreshold={owned.percentThreshold}
          absoluteThreshold={owned.absoluteThreshold}
          thresholdMode={owned.thresholdMode}
          enabled={owned.enabled}
          onChange={patchOwned}
        />
        <ThresholdGroup
          label="Competitors"
          description="Alert when competitor posts go viral"
          percentThreshold={competitor.percentThreshold}
          absoluteThreshold={competitor.absoluteThreshold}
          thresholdMode={competitor.thresholdMode}
          enabled={competitor.enabled}
          onChange={patchCompetitor}
        />
      </div>

      <div className="liquid-glass rounded-2xl overflow-hidden">
        <GroupRow label="Detection window" tip="Time period for measuring view growth.">
          <span className="text-[13px] font-semibold text-accent-400 tabular-nums">{settings.time_frame_hours}h</span>
        </GroupRow>
        <GroupRow label="Additional recipients" tip="Extra email addresses that receive alert notifications.">
          <span className="text-[13px] font-semibold text-accent-400 tabular-nums">{settings.additional_emails.length} emails</span>
        </GroupRow>
        <GroupRow label="Debounce" tip="Same post will not re-trigger an alert within this window." isLast>
          <span className="text-[13px] font-semibold text-text-secondary tabular-nums">12h</span>
        </GroupRow>
      </div>
    </div>
  );
}
