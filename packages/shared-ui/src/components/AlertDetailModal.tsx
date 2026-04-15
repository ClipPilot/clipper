"use client";

import { Modal, Button, Chip, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  deriveSnapshotSeverity,
  type AlertSeverity,
  type ViralPostSnapshot,
} from "../utils/alertSeverity";
import type { AlertLogWithSnapshot } from "./AlertFeedTable";

const PLATFORM_ICON: Record<string, { icon: string; color: string }> = {
  tiktok: { icon: "ri:tiktok-fill", color: "text-cyan-500" },
  instagram: { icon: "ri:instagram-fill", color: "text-pink-500" },
  youtube: { icon: "ri:youtube-fill", color: "text-red-500" },
  twitter: { icon: "ri:twitter-x-fill", color: "text-text-primary" },
  x: { icon: "ri:twitter-x-fill", color: "text-text-primary" },
};

const SEV_CHIP: Record<AlertSeverity, { color: "danger" | "warning" | "success"; bg: string }> = {
  high: { color: "danger", bg: "bg-red-500/15" },
  medium: { color: "warning", bg: "bg-orange-500/15" },
  low: { color: "success", bg: "bg-green-500/15" },
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
  const groups = groupByAccount(snapshot);

  return (
    <Modal>
      <Modal.Backdrop isOpen={!!alert} onOpenChange={handleOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="glass-panel sm:max-w-2xl !rounded-2xl overflow-hidden">
            <Modal.Body className="p-0 max-h-[85vh] overflow-hidden flex flex-col !bg-transparent">

              <div className="px-6 pt-6 pb-4 shrink-0 border-b border-border-base">
                <div className="flex items-center gap-2 mb-3">
                  <Chip size="sm" color={SEV_CHIP[sev].color} className={SEV_CHIP[sev].bg}>{sev.toUpperCase()}</Chip>
                  <Chip size="sm" color={alert.status === "sent" ? "success" : "danger"}>{alert.status}</Chip>
                  <Chip size="sm" variant="soft">{settings.time_frame_hours}h window</Chip>
                </div>
                <p className="text-lg font-semibold text-text-primary leading-snug mb-1.5">{alert.subject}</p>
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
                      <div className="flex-1 h-px bg-border-base" />
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

              <div className="px-6 py-3.5 shrink-0 flex items-center justify-between border-t border-border-base">
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
  onClone,
}: {
  post: ViralPostSnapshot;
  settings: AlertSettingsData;
  alertId: number;
  onNotify: (id: number) => Promise<void>;
  onShare: (postUrl: string) => void;
  onClone: (postUrl: string) => void;
}) {
  const sev = deriveSnapshotSeverity([post], settings);

  return (
    <div className="bg-surface-elevated border border-border-base rounded-xl p-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center bg-surface-elevated border border-border-base">
          <Icon
            icon={PLATFORM_ICON[post.platform.toLowerCase()]?.icon ?? "ri:global-line"}
            width={24}
            className={PLATFORM_ICON[post.platform.toLowerCase()]?.color ?? "text-text-tertiary"}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent-400">
              {post.platform}
            </span>
            <Chip size="sm" color={SEV_CHIP[sev].color} className={`text-[10px] ${SEV_CHIP[sev].bg}`}>
              +{Math.round(post.percentIncrease ?? 0)}% in {settings.time_frame_hours}h
            </Chip>
          </div>

          <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2 mb-2.5">
            {post.caption ?? "No caption"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-border-base">
        {[
          { val: `+${formatNumber(post.viewsIncrease)}`, lbl: "Views gained" },
          { val: formatNumber(post.currentViews), lbl: "Total views" },
          { val: formatNumber(post.likeCount), lbl: "Likes" },
          { val: formatNumber(post.commentCount), lbl: "Comments" },
        ].map(({ val, lbl }) => (
          <div key={lbl} className="text-center">
            <p className="text-sm font-bold text-accent-400 tabular-nums">{val}</p>
            <p className="text-[10px] text-text-tertiary mt-0.5">{lbl}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-base">
        <Button size="sm" className="bg-green-500 text-white text-[11px] h-7 min-w-0 px-3" onPress={() => onShare(post.postUrl)}>Share</Button>
        <Tooltip><Tooltip.Trigger><span><Button size="sm" className="text-[11px] h-7 min-w-0 px-3" isDisabled>Clone</Button></span></Tooltip.Trigger><Tooltip.Content>Coming soon</Tooltip.Content></Tooltip>
        <Button size="sm" className="bg-orange-500 text-white text-[11px] h-7 min-w-0 px-3" onPress={() => onNotify(alertId)}>Notify</Button>
        <Button size="sm" variant="outline" className="text-[11px] h-7 min-w-0 px-3 ml-auto" onPress={() => window.open(post.postUrl, "_blank")}>View post</Button>
      </div>
    </div>
  );
}
