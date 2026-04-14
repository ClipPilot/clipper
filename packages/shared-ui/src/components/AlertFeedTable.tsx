"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { PaginationControl } from "./PaginationControl";
import { deriveSnapshotSeverity, deriveSnapshotType, type AlertSeverity, type ViralPostSnapshot } from "../utils/alertSeverity";

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

const PLATFORM_ABBR: Record<string, string> = {
  tiktok: "TK",
  instagram: "IG",
  youtube: "YT",
  twitter: "TW",
  x: "TW",
};

const SEV_CHIP: Record<AlertSeverity, { color: "danger" | "warning" | "success"; bg: string }> = {
  high: { color: "danger", bg: "bg-red-500/15" },
  medium: { color: "warning", bg: "bg-orange-500/15" },
  low: { color: "success", bg: "bg-green-500/15" },
};

const TYPE_CHIP: Record<string, { color: "danger" | "success" | "accent"; bg: string }> = {
  Competitor: { color: "danger", bg: "bg-red-500/10" },
  Owned: { color: "success", bg: "bg-green-500/10" },
  Mixed: { color: "accent", bg: "bg-accent-400/10" },
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

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

type SeverityFilter = "all" | AlertSeverity;
type TypeFilter = "all" | "Competitor" | "Owned";

export interface AlertFeedTableProps {
  alerts: AlertLogWithSnapshot[];
  total: number;
  page: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onAlertClick: (alert: AlertLogWithSnapshot) => void;
  settings: AlertSettingsForSeverity;
  onNotify: (alertId: number) => Promise<void>;
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
}: AlertFeedTableProps) {
  const router = useRouter();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const enriched = alerts.map((a) => ({
    alert: a,
    sev: a.alert_posts_snapshot.length ? deriveSnapshotSeverity(a.alert_posts_snapshot, settings) : ("low" as AlertSeverity),
    type: a.alert_posts_snapshot.length ? deriveSnapshotType(a.alert_posts_snapshot) : ("Mixed" as const),
  }));

  const filtered = enriched.filter(({ sev, type }) => {
    if (severityFilter !== "all" && sev !== severityFilter) return false;
    if (typeFilter !== "all" && type !== typeFilter) return false;
    return true;
  });

  function handleShare(alert: AlertLogWithSnapshot) {
    const first = alert.alert_posts_snapshot[0];
    if (!first) return;
    navigator.clipboard.writeText(first.postUrl).catch(() => {});
  }

  function handleClone(alert: AlertLogWithSnapshot) {
    const first = alert.alert_posts_snapshot[0];
    if (!first) return;
    router.push(`/dashboard/ad-clone?postUrl=${encodeURIComponent(first.postUrl)}`);
  }

  function handleNotify(alert: AlertLogWithSnapshot) {
    onNotify(alert.id).catch(() => {});
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-text-primary">Alert Feed</p>
          <p className="text-xs text-text-tertiary mt-0.5">Click any row to view full alert details</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <span className="text-[10px] text-text-tertiary mr-1">Severity</span>
          {(["all", "high", "medium", "low"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={severityFilter === s ? "secondary" : "outline"}
              className={`text-[11px] h-6 min-w-0 px-2.5 rounded-full ${
                severityFilter === s
                  ? "bg-accent-400/15 text-accent-400 border-accent-400/30"
                  : "text-text-tertiary border-border-base"
              }`}
              onPress={() => setSeverityFilter(s)}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
          <div className="w-px h-4 bg-border-base mx-1" />
          <span className="text-[10px] text-text-tertiary mr-1">Type</span>
          {(["all", "Competitor", "Owned"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={typeFilter === t ? "secondary" : "outline"}
              className={`text-[11px] h-6 min-w-0 px-2.5 rounded-full ${
                typeFilter === t
                  ? "bg-accent-400/15 text-accent-400 border-accent-400/30"
                  : "text-text-tertiary border-border-base"
              }`}
              onPress={() => setTypeFilter(t)}
            >
              {t === "all" ? "All" : t}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 pb-2.5 mb-1 border-b border-border-base">
        <div style={{ width: 120 }} className="flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Alert</span>
          <Tooltip><Tooltip.Trigger><span className="cursor-help"><Icon icon="solar:info-circle-linear" width={11} className="text-text-tertiary" /></span></Tooltip.Trigger><Tooltip.Content>Type (Owned/Competitor/Mixed) and severity level (High/Medium/Low) of the alert</Tooltip.Content></Tooltip>
        </div>
        <div className="flex-1 flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Trigger</span>
          <Tooltip><Tooltip.Trigger><span className="cursor-help"><Icon icon="solar:info-circle-linear" width={11} className="text-text-tertiary" /></span></Tooltip.Trigger><Tooltip.Content>The viral post that triggered this alert, with view growth stats</Tooltip.Content></Tooltip>
        </div>
        <div style={{ width: 100 }} className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Time</div>
        <div style={{ width: 160 }} className="flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Actions</span>
          <Tooltip><Tooltip.Trigger><span className="cursor-help"><Icon icon="solar:info-circle-linear" width={11} className="text-text-tertiary" /></span></Tooltip.Trigger><Tooltip.Content>Share copies the post URL. Clone opens the ad cloner. Notify re-sends the alert email to your team.</Tooltip.Content></Tooltip>
        </div>
      </div>

      <div className="space-y-0.5">
        {filtered.map(({ alert, sev, type }) => {
          const first = alert.alert_posts_snapshot[0];
          return (
            <div
              key={alert.id}
              onClick={() => onAlertClick(alert)}
              className="flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-colors hover:bg-surface-hover"
            >
              <div style={{ width: 120 }} className="flex flex-col gap-1 shrink-0 items-start">
                <Chip size="sm" color={TYPE_CHIP[type].color} className={`text-[10px] ${TYPE_CHIP[type].bg}`}>{type}</Chip>
                <Chip size="sm" color={SEV_CHIP[sev].color} className={`text-[10px] font-bold ${SEV_CHIP[sev].bg}`}>{sev.toUpperCase()}</Chip>
              </div>

              <div className="flex-1 flex items-center gap-3 min-w-0">
                {first?.thumbnailUrl ? (
                  <img
                    src={first.thumbnailUrl}
                    alt=""
                    className="w-9 h-9 rounded-lg object-cover shrink-0 border border-border-base"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-text-tertiary shrink-0 bg-surface-elevated border border-border-base">
                    {first ? (PLATFORM_ABBR[first.platform.toLowerCase()] ?? "??") : "\u2014"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate max-w-xs">
                    {first?.caption ?? alert.subject}
                  </p>
                  {first && (
                    <p className="text-[11px] text-text-tertiary mt-0.5 truncate">
                      <span className="text-accent-400 font-semibold">+{formatNumber(first.viewsIncrease)} views</span>
                      {" \u00b7 "}+{Math.round(first.percentIncrease)}%{" \u00b7 "}
                      {first.platform}{" \u00b7 "}@{first.accountHandle}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ width: 100 }} className="shrink-0">
                <p className="text-xs text-text-secondary font-medium">{formatRelativeTime(alert.sent_at)}</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">
                  {new Date(alert.sent_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              </div>

              <div
                style={{ width: 160 }}
                className="flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="sm" variant="tertiary" className="bg-green-500/10 text-green-500 text-[10px] h-7 min-w-0 px-2.5" onPress={() => handleShare(alert)}>Share</Button>
                <Button size="sm" variant="tertiary" className="bg-accent-400/10 text-accent-400 text-[10px] h-7 min-w-0 px-2.5" onPress={() => handleClone(alert)}>Clone</Button>
                <Button size="sm" variant="tertiary" className="bg-orange-500/10 text-orange-400 text-[10px] h-7 min-w-0 px-2.5" onPress={() => handleNotify(alert)}>Notify</Button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-text-tertiary">
            No alerts match the current filters
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 mt-3 border-t border-border-base">
        <span className="text-[11px] text-text-tertiary">
          Showing {filtered.length} of {total} alerts
        </span>
        <PaginationControl page={page} total={totalPages} onChange={onPageChange} />
      </div>
    </div>
  );
}
