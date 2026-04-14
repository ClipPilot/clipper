"use client";

import { useRouter } from "next/navigation";
import { Modal, Button, Chip } from "@heroui/react";
import {
  deriveSnapshotSeverity,
  deriveSnapshotType,
  type AlertSeverity,
  type ViralPostSnapshot,
} from "../utils/alertSeverity";
import type { AlertLogWithSnapshot } from "./AlertFeedTable";

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

function formatNumber(n: number) {
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
}

export function AlertDetailModal({ alert, onClose, settings, onNotify }: AlertDetailModalProps) {
  const router = useRouter();

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  if (!alert) return null;

  const snapshot = alert.alert_posts_snapshot;
  const sev = snapshot.length ? deriveSnapshotSeverity(snapshot, settings) : ("low" as AlertSeverity);
  const type = snapshot.length ? deriveSnapshotType(snapshot) : "Mixed";
  const groups = groupByAccount(snapshot);

  return (
    <Modal>
      <Modal.Backdrop isOpen={!!alert} onOpenChange={handleOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-2xl">
            <Modal.Body className="p-0 max-h-[85vh] overflow-hidden flex flex-col">
              <div className="px-6 pt-5 pb-4 shrink-0 border-b border-border-base">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Chip size="sm" color={SEV_CHIP[sev].color} className={SEV_CHIP[sev].bg}>{sev.toUpperCase()}</Chip>
                  <Chip size="sm" color={TYPE_CHIP[type].color} className={TYPE_CHIP[type].bg}>{type}</Chip>
                  <Chip size="sm" color={alert.status === "sent" ? "success" : "danger"}>{alert.status}</Chip>
                </div>
                <p className="text-base font-semibold text-text-primary leading-snug mb-2">{alert.subject}</p>
                <div className="flex items-center gap-4 text-[11px] text-text-tertiary">
                  <span>{new Date(alert.sent_at).toLocaleString()}</span>
                  <Chip size="sm" variant="soft">{settings.time_frame_hours}h window</Chip>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {groups.map((group) => (
                  <div key={`${group.groupName}:${group.handle}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                        @{group.handle}
                      </span>
                      {group.groupName && (
                        <span className="text-[10px] text-text-tertiary uppercase tracking-wide">{group.groupName}</span>
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
                          router={router}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="text-sm text-text-tertiary text-center py-8">No post data available for this alert</p>
                )}
              </div>

              <div className="px-6 py-3 shrink-0 flex items-center justify-between border-t border-border-base">
                <p className="text-[11px] text-text-tertiary">
                  Sent to <span className="text-text-secondary">{alert.email}</span>
                </p>
                <p className="text-[11px] text-text-tertiary">Snapshot captured at time of alert</p>
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
  router,
}: {
  post: ViralPostSnapshot;
  settings: AlertSettingsData;
  alertId: number;
  onNotify: (id: number) => Promise<void>;
  router: ReturnType<typeof useRouter>;
}) {
  const sev = deriveSnapshotSeverity([post], settings);

  return (
    <div className="glass-inner flex gap-4 rounded-xl p-4">
      {post.thumbnailUrl ? (
        <img
          src={post.thumbnailUrl}
          alt=""
          className="rounded-xl object-cover shrink-0 border border-border-base"
          style={{ width: 64, height: 80 }}
        />
      ) : (
        <div
          className="rounded-xl shrink-0 flex items-center justify-center text-sm font-bold text-text-tertiary bg-surface-base border border-border-base"
          style={{ width: 64, height: 80 }}
        >
          {PLATFORM_ABBR[post.platform.toLowerCase()] ?? "??"}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-accent-400">
            {post.platform}
          </span>
          <Chip size="sm" color={SEV_CHIP[sev].color} className={SEV_CHIP[sev].bg}>
            +{Math.round(post.percentIncrease)}% in {settings.time_frame_hours}h
          </Chip>
        </div>

        <p className="text-[13px] font-medium text-text-primary leading-snug line-clamp-2 mb-3">
          {post.caption ?? "No caption"}
        </p>

        <div className="flex gap-5 mb-3">
          {[
            { val: `+${formatNumber(post.viewsIncrease)}`, lbl: "Views gained" },
            { val: formatNumber(post.currentViews), lbl: "Total views" },
            { val: formatNumber(post.likeCount), lbl: "Likes" },
            { val: formatNumber(post.commentCount), lbl: "Comments" },
          ].map(({ val, lbl }) => (
            <div key={lbl}>
              <p className="text-sm font-bold text-accent-400 tabular-nums">{val}</p>
              <p className="text-[10px] text-text-tertiary mt-0.5">{lbl}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="tertiary" className="bg-green-500/10 text-green-500 text-[10px] h-7 min-w-0 px-2.5" onPress={() => navigator.clipboard.writeText(post.postUrl).catch(() => {})}>Share</Button>
          <Button size="sm" variant="tertiary" className="bg-accent-400/10 text-accent-400 text-[10px] h-7 min-w-0 px-2.5" onPress={() => router.push(`/dashboard/ad-clone?postUrl=${encodeURIComponent(post.postUrl)}`)}>Clone</Button>
          <Button size="sm" variant="tertiary" className="bg-orange-500/10 text-orange-400 text-[10px] h-7 min-w-0 px-2.5" onPress={() => onNotify(alertId).catch(() => {})}>Notify</Button>
          <Button size="sm" variant="tertiary" className="text-text-tertiary text-[10px] h-7 min-w-0 px-2.5 ml-auto" onPress={() => window.open(post.postUrl, "_blank")}>View post</Button>
        </div>
      </div>
    </div>
  );
}
