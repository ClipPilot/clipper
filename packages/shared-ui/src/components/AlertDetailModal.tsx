"use client";

import { Modal, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  deriveSnapshotSeverity,
  type AlertSeverity,
  type ViralPostSnapshot,
} from "../utils/alertSeverity";
import type { AlertLogWithSnapshot } from "./AlertFeedTable";

const PLATFORM_ICON: Record<string, { icon: string; color: string }> = {
  tiktok: { icon: "ri:tiktok-fill", color: "text-cyan-400" },
  instagram: { icon: "ri:instagram-fill", color: "text-pink-400" },
  youtube: { icon: "ri:youtube-fill", color: "text-red-400" },
  twitter: { icon: "ri:twitter-x-fill", color: "text-text-primary" },
  x: { icon: "ri:twitter-x-fill", color: "text-text-primary" },
};

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

function formatNumber(n: number | undefined | null) {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function groupByAccount(posts: ViralPostSnapshot[]) {
  const map = new Map<string, { handle: string; groupName: string; posts: ViralPostSnapshot[] }>();
  for (const post of posts) {
    const key = `${post.groupName}:${post.accountHandle}`;
    if (!map.has(key)) map.set(key, { handle: post.accountHandle, groupName: post.groupName, posts: [] });
    map.get(key)!.posts.push(post);
  }
  return Array.from(map.values());
}

interface AlertSettingsData {
  owned_percent_threshold: number;
  owned_absolute_threshold: number;
  competitor_percent_threshold: number;
  competitor_absolute_threshold: number;
  time_frame_hours: number;
}

export interface AlertDetailModalProps {
  alert: AlertLogWithSnapshot | null;
  onClose: () => void;
  settings: AlertSettingsData;
  onNotify: (alertId: number) => Promise<void>;
  onShare: (postUrl: string) => void;
  onClone: (postUrl: string) => void;
}

export function AlertDetailModal({ alert, onClose, settings, onNotify, onShare, onClone }: AlertDetailModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  if (!alert) return null;

  const snapshot = alert.alert_posts_snapshot;
  const sev = snapshot.length ? deriveSnapshotSeverity(snapshot, settings) : ("low" as AlertSeverity);
  const sevStyle = SEV_STYLE[sev];
  const groups = groupByAccount(snapshot);

  return (
    <Modal>
      <Modal.Backdrop isOpen={!!alert} onOpenChange={handleOpenChange} className="!bg-black/40">
        <Modal.Container>
          <Modal.Dialog
            className="sm:max-w-2xl !rounded-3xl overflow-hidden !border !border-white/15 !shadow-[0_20px_70px_-10px_rgba(0,0,0,0.5)]"
            style={{
              background: "linear-gradient(180deg, rgba(40,40,60,0.55) 0%, rgba(18,18,32,0.7) 100%)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
            }}
          >
            <Modal.Body className="p-0 max-h-[85vh] overflow-hidden flex flex-col !bg-transparent">

              <div className="px-6 pt-6 pb-5 shrink-0 border-b border-white/[0.08]">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${sevStyle.chip}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sevStyle.dot}`} />
                    {sevStyle.label}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${
                    alert.status === "sent"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                      : "bg-rose-500/15 text-rose-300 border-rose-400/30"
                  }`}>
                    {alert.status}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-semibold text-text-secondary tracking-wide">
                    {settings.time_frame_hours}h window
                  </span>
                </div>
                <p className="text-[17px] font-semibold text-text-primary leading-snug tracking-tight mb-1.5">{alert.subject}</p>
                <p className="text-[11px] text-text-tertiary">{new Date(alert.sent_at).toLocaleString()}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {groups.map((group) => (
                  <div key={`${group.groupName}:${group.handle}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] font-semibold text-text-secondary">
                        @{group.handle}
                      </span>
                      {group.groupName && (
                        <>
                          <span className="text-[10px] text-text-tertiary">/</span>
                          <span className="text-[10px] text-text-tertiary">{group.groupName}</span>
                        </>
                      )}
                      <div className="flex-1 h-px bg-white/[0.08]" />
                    </div>
                    <div className="space-y-3">
                      {group.posts.map((post) => (
                        <PostCard
                          key={post.postId}
                          post={post}
                          settings={settings}
                          alertId={alert.id}
                          onNotify={onNotify}
                          onShare={onShare}
                          onClone={onClone}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="text-sm text-text-tertiary text-center py-8">No post data available for this alert</p>
                )}
              </div>

              <div className="px-6 py-3.5 shrink-0 flex items-center justify-between border-t border-white/[0.08]">
                <p className="text-[11px] text-text-tertiary">
                  Sent to <span className="text-text-secondary font-medium">{alert.email}</span>
                </p>
                <p className="text-[10px] text-text-tertiary">Snapshot at time of alert</p>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function PostCard({
  post,
  settings,
  alertId,
  onNotify,
  onShare,
  onClone: _onClone,
}: {
  post: ViralPostSnapshot;
  settings: AlertSettingsData;
  alertId: number;
  onNotify: (id: number) => Promise<void>;
  onShare: (postUrl: string) => void;
  onClone: (postUrl: string) => void;
}) {
  const sev = deriveSnapshotSeverity([post], settings);
  const sevStyle = SEV_STYLE[sev];
  const platform = PLATFORM_ICON[post.platform.toLowerCase()] ?? { icon: "ri:global-line", color: "text-text-tertiary" };

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center bg-white/[0.05] border border-white/[0.08]">
          <Icon icon={platform.icon} width={22} className={platform.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-400">
              {post.platform}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sevStyle.chip}`}>
              +{Math.round(post.percentIncrease ?? 0)}% in {settings.time_frame_hours}h
            </span>
          </div>

          <p className="text-[13px] font-medium text-text-primary leading-snug line-clamp-2">
            {post.caption ?? "No caption"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/[0.08]">
        {[
          { val: `+${formatNumber(post.viewsIncrease)}`, lbl: "Views gained" },
          { val: formatNumber(post.currentViews), lbl: "Total views" },
          { val: formatNumber(post.likeCount), lbl: "Likes" },
          { val: formatNumber(post.commentCount), lbl: "Comments" },
        ].map(({ val, lbl }) => (
          <div key={lbl} className="text-center">
            <p className="text-[14px] font-bold text-accent-400 tabular-nums">{val}</p>
            <p className="text-[10px] text-text-tertiary mt-0.5">{lbl}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-white/[0.08]">
        <Tooltip>
          <Tooltip.Trigger>
            <button
              type="button"
              onClick={() => onShare(post.postUrl)}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/[0.08] text-text-secondary hover:text-text-primary hover:bg-white/[0.1] transition"
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
              onClick={() => onNotify(alertId)}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-400/15 border border-accent-400/30 text-accent-400 hover:bg-accent-400/25 transition"
            >
              <Icon icon="solar:bell-bing-linear" width={14} />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Re-notify team</Tooltip.Content>
        </Tooltip>
        <button
          type="button"
          onClick={() => window.open(post.postUrl, "_blank")}
          className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] text-text-primary hover:bg-white/[0.1] transition"
        >
          View post
          <Icon icon="solar:arrow-right-up-linear" width={12} />
        </button>
      </div>
    </div>
  );
}
