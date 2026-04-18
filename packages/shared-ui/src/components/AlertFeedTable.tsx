"use client";

import { useState } from "react";
import { Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { PaginationControl } from "./PaginationControl";
import { SegmentedControl } from "./SegmentedControl";
import { deriveSnapshotSeverity, type AlertSeverity, type ViralPostSnapshot } from "../utils/alertSeverity";

interface AlertLog {
  id: number;
  team_id: number;
  user_id: number | null;
  email: string;
  subject: string;
  email_body: string;
  viral_post_ids: number[];
  status: "sent" | "failed";
  error_message: string | null;
  sent_at: string;
  created_at: string;
}

export interface AlertLogWithSnapshot extends AlertLog {
  alert_posts_snapshot: ViralPostSnapshot[];
}

interface AlertSettingsForSeverity {
  owned_percent_threshold: number;
  owned_absolute_threshold: number;
  competitor_percent_threshold: number;
  competitor_absolute_threshold: number;
}

const SEV_STYLE: Record<AlertSeverity, { label: string; dot: string; chip: string }> = {
  high: {
    label: "High",
    dot: "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.6)]",
    chip: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  },
  medium: {
    label: "Medium",
    dot: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)]",
    chip: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  },
  low: {
    label: "Low",
    dot: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]",
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  },
};

function formatRelativeTime(dateStr: string) {
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return "Unknown";
  const h = Math.floor((Date.now() - ts) / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  if (h < 48) return "Yesterday";
  return new Date(dateStr).toLocaleDateString();
}

function formatNumber(n: number | undefined | null) {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

type SeverityFilter = "all" | AlertSeverity;

export interface AlertFeedTableProps {
  alerts: AlertLogWithSnapshot[];
  total: number;
  page: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onAlertClick: (alert: AlertLogWithSnapshot) => void;
  settings: AlertSettingsForSeverity;
  onNotify: (alertId: number) => Promise<void>;
  onShare: (postUrl: string) => void;
  onClone: (postUrl: string) => void;
}

export function AlertFeedTable({
  alerts,
  total,
  page,
  pageSize = 20,
  onPageChange,
  onAlertClick,
  settings,
  onNotify,
  onShare,
  onClone: _onClone,
}: AlertFeedTableProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const enriched = alerts.map((a) => ({
    alert: a,
    sev: a.alert_posts_snapshot.length ? deriveSnapshotSeverity(a.alert_posts_snapshot, settings) : ("low" as AlertSeverity),
  }));

  const filtered = enriched.filter(({ sev }) => {
    if (severityFilter !== "all" && sev !== severityFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between px-1.5">
        <div>
          <p className="text-[15px] font-semibold text-text-primary">Alert Feed</p>
          <p className="text-[12px] text-text-tertiary mt-0.5">Click any row to view full alert details</p>
        </div>
        <SegmentedControl<SeverityFilter>
          value={severityFilter}
          onChange={setSeverityFilter}
          options={[
            { value: "all", label: "All" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />
      </div>

      <div className="liquid-glass rounded-2xl overflow-hidden">
        {filtered.map(({ alert, sev }, idx) => {
          const first = alert.alert_posts_snapshot[0];
          const hasPost = !!first;
          const sevStyle = SEV_STYLE[sev];
          return (
            <div
              key={alert.id}
              onClick={() => onAlertClick(alert)}
              className={`group relative flex items-center gap-5 px-5 py-4 cursor-pointer transition-colors hover:bg-white/[0.04] ${
                idx !== filtered.length - 1 ? "border-b border-white/[0.08]" : ""
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${sevStyle.dot}`} aria-label={sevStyle.label} />

              <div className="flex-1 flex items-center gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-text-primary truncate">
                    {first?.caption ?? alert.subject}
                  </p>
                  {first && (
                    <p className="text-[11px] text-text-tertiary mt-1 truncate flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${sevStyle.chip}`}>
                        +{formatNumber(first.viewsIncrease)} views
                      </span>
                      <span className="text-text-tertiary">+{Math.round(first.percentIncrease)}%</span>
                      <span className="text-white/30">·</span>
                      <span className="capitalize">{first.platform}</span>
                      <span className="text-white/30">·</span>
                      <span>@{first.accountHandle}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[12px] text-text-secondary font-medium tabular-nums">{formatRelativeTime(alert.sent_at)}</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">
                  {new Date(alert.sent_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              </div>

              <div
                className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition"
                onClick={(e) => e.stopPropagation()}
              >
                <Tooltip>
                  <Tooltip.Trigger>
                    <button
                      type="button"
                      disabled={!hasPost}
                      onClick={() => hasPost && onShare(first!.postUrl)}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/[0.08] text-text-secondary hover:text-text-primary hover:bg-white/[0.1] transition disabled:opacity-40"
                    >
                      <Icon icon="solar:copy-linear" width={14} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Copy post URL</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                  <Tooltip.Trigger>
                    <button
                      type="button"
                      onClick={() => onNotify(alert.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-400/15 border border-accent-400/30 text-accent-400 hover:bg-accent-400/25 transition"
                    >
                      <Icon icon="solar:bell-bing-linear" width={14} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Re-notify team</Tooltip.Content>
                </Tooltip>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-3">
              <Icon icon="solar:bell-off-linear" width={20} className="text-text-tertiary" />
            </div>
            <p className="text-[13px] text-text-tertiary">No alerts match the current filters</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-1.5">
        <span className="text-[11px] text-text-tertiary">
          Showing {filtered.length} of {total} alerts
        </span>
        <PaginationControl page={page} total={totalPages} onChange={onPageChange} />
      </div>
    </div>
  );
}
