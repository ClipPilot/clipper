"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  adminAPI,
  CampaignDetail,
  CampaignVideo,
  CampaignPost,
} from "@/lib/api";

// ── Platform config ─────────────────────────────────────────────
const PLATFORMS = [
  {
    key: "tiktok",
    label: "TikTok",
    color: "bg-pink-500/10 border-pink-500/20 text-pink-400",
    activeColor: "bg-pink-500/20 border-pink-400/40",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.27 8.27 0 004.84 1.55V6.82a4.84 4.84 0 01-1.08-.13z" />
      </svg>
    ),
  },
  {
    key: "instagram",
    label: "Instagram",
    color: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    activeColor: "bg-purple-500/20 border-purple-400/40",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    key: "facebook",
    label: "Facebook",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    activeColor: "bg-blue-500/20 border-blue-400/40",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    key: "youtube",
    label: "YouTube",
    color: "bg-red-500/10 border-red-500/20 text-red-400",
    activeColor: "bg-red-500/20 border-red-400/40",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    key: "x",
    label: "X",
    color: "bg-gray-500/10 border-gray-500/20 text-gray-400",
    activeColor: "bg-gray-500/20 border-gray-400/40",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

const PLATFORM_ICON_MAP: Record<string, (typeof PLATFORMS)[number]> = {};
PLATFORMS.forEach((p) => {
  PLATFORM_ICON_MAP[p.key] = p;
});

// ── Helpers ─────────────────────────────────────────────────────
function getStatusBadgeClass(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    accepted: "bg-emerald/10 border-emerald/20 text-emerald",
    rejected: "bg-red-500/10 border-red-500/20 text-red-400",
    appeal: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    started: "bg-green-500/10 border-green-500/20 text-green-400",
    paused: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    completed: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  };
  return colors[status] || colors.pending;
}

function getPostStatusStyle(status: string) {
  const styles: Record<string, { class: string; label: string }> = {
    processing: {
      class: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
      label: "Processing",
    },
    scheduled: {
      class: "bg-blue-500/10 border-blue-500/20 text-blue-400",
      label: "In Drive",
    },
    posted: {
      class: "bg-green-500/10 border-green-500/20 text-green-400",
      label: "Published",
    },
    failed: {
      class: "bg-red-500/10 border-red-500/20 text-red-400",
      label: "Failed",
    },
  };
  return styles[status] || styles.processing;
}

function PlatformChip({ platform }: { platform: string }) {
  const p = PLATFORM_ICON_MAP[platform];
  if (!p)
    return (
      <span className="text-xs text-text-tertiary capitalize">{platform}</span>
    );
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${p.color}`}
    >
      <span className="w-3.5 h-3.5 [&>svg]:w-3.5 [&>svg]:h-3.5">{p.icon}</span>
      {p.label}
    </span>
  );
}

// ── Publish Modal ───────────────────────────────────────────────
function PublishModal({
  clips,
  onClose,
  onPublishClip,
  onComplete,
}: {
  clips: { clipId: number; title: string }[];
  onClose: () => void;
  onPublishClip: (
    clipId: number,
    platformQty: Record<string, number>,
    scramblingLevel: "light" | "heavy",
  ) => Promise<number>;
  onComplete: (totalQueued: number, failed: number) => void;
}) {
  const isBulk = clips.length > 1;
  const [platformQty, setPlatformQty] = useState<Record<string, number>>({});
  const [scramblingLevel, setScramblingLevel] = useState<"light" | "heavy">(
    "light",
  );
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    failed: number;
  } | null>(null);
  const totalCopies = Object.values(platformQty).reduce((s, v) => s + v, 0);

  const handleSubmit = async () => {
    const active = Object.fromEntries(
      Object.entries(platformQty).filter(([, v]) => v > 0),
    );
    if (Object.keys(active).length === 0) {
      setError("Select at least one platform");
      return;
    }
    setIsPosting(true);
    setError("");
    try {
      if (isBulk) {
        // Bulk: fire all clips in parallel, track progress
        setProgress({ done: 0, total: clips.length, failed: 0 });
        let done = 0;
        let failed = 0;
        let totalQueued = 0;
        const results = await Promise.allSettled(
          clips.map(async (clip) => {
            const count = await onPublishClip(
              clip.clipId,
              active,
              scramblingLevel,
            );
            totalQueued += count;
            done++;
            setProgress({ done, total: clips.length, failed });
            return count;
          }),
        );
        failed = results.filter((r) => r.status === "rejected").length;
        onComplete(totalQueued, failed);
      } else {
        const count = await onPublishClip(
          clips[0].clipId,
          active,
          scramblingLevel,
        );
        onComplete(count, 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
      setIsPosting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                {isBulk
                  ? `Publish ${clips.length} Videos`
                  : "Publish to Platforms"}
              </h2>
              <p className="text-sm text-text-secondary mt-0.5">
                {isBulk
                  ? `${clips.length} videos selected`
                  : `${clips[0].title} \u00b7 Clip #${clips[0].clipId}`}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isPosting}
              className="w-8 h-8 rounded-lg bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          {progress && (
            <div className="p-3 rounded-lg bg-emerald/10 border border-emerald/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-emerald font-medium">
                  Publishing {progress.done}/{progress.total}...
                </span>
                {progress.failed > 0 && (
                  <span className="text-xs text-red-400">
                    {progress.failed} failed
                  </span>
                )}
              </div>
              <div className="w-full bg-surface rounded-full h-1.5">
                <div
                  className="bg-emerald h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${(progress.done / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
          {PLATFORMS.map((p) => {
            const qty = platformQty[p.key] || 0;
            const isActive = qty > 0;
            return (
              <div
                key={p.key}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isActive ? `${p.activeColor} shadow-sm` : "border-border bg-surface-elevated"}`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${p.color}`}
                >
                  {p.icon}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-text-primary">
                    {p.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setPlatformQty((prev) => ({
                        ...prev,
                        [p.key]: Math.max(0, (prev[p.key] || 0) - 1),
                      }))
                    }
                    disabled={qty === 0 || isPosting}
                    className="w-8 h-8 rounded-lg bg-surface border border-border text-text-secondary hover:bg-surface-hover disabled:opacity-20 transition-colors flex items-center justify-center font-medium"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={qty || ""}
                    disabled={isPosting}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setPlatformQty((prev) => ({
                        ...prev,
                        [p.key]: Math.min(50, Math.max(0, val)),
                      }));
                    }}
                    placeholder="0"
                    className="w-12 px-1 py-1.5 rounded-lg bg-surface border border-border text-text-primary text-sm text-center focus:border-emerald outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={() =>
                      setPlatformQty((prev) => ({
                        ...prev,
                        [p.key]: Math.min(50, (prev[p.key] || 0) + 1),
                      }))
                    }
                    disabled={qty >= 50 || isPosting}
                    className="w-8 h-8 rounded-lg bg-surface border border-border text-text-secondary hover:bg-surface-hover disabled:opacity-20 transition-colors flex items-center justify-center font-medium"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}

          {/* Scrambling Level */}
          <div className="mt-4 p-4 rounded-xl border border-border bg-surface-elevated">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setScramblingLevel("light")}
                disabled={isPosting}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  scramblingLevel === "light"
                    ? "bg-emerald text-black"
                    : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                } disabled:opacity-50`}
              >
                Light
              </button>
              <button
                onClick={() => setScramblingLevel("heavy")}
                disabled={isPosting}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  scramblingLevel === "heavy"
                    ? "bg-emerald text-black"
                    : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                } disabled:opacity-50`}
              >
                Heavy
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-surface-elevated/50">
          <div className="text-sm text-text-secondary">
            {isBulk ? (
              <>
                Total:{" "}
                <span className="font-bold text-text-primary text-lg">
                  {totalCopies * clips.length}
                </span>{" "}
                posts ({totalCopies} &times; {clips.length} videos)
              </>
            ) : (
              <>
                Total:{" "}
                <span className="font-bold text-text-primary text-lg">
                  {totalCopies}
                </span>{" "}
                {totalCopies === 1 ? "copy" : "copies"}
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isPosting}
              className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPosting || totalCopies === 0}
              className="px-5 py-2.5 rounded-lg bg-emerald text-black font-semibold text-sm hover:bg-emerald-light transition-colors disabled:opacity-50"
            >
              {isPosting
                ? progress
                  ? `Publishing ${progress.done}/${progress.total}...`
                  : "Publishing..."
                : isBulk
                  ? `Publish ${clips.length} Videos`
                  : `Publish ${totalCopies} Copies`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Video Player Modal ──────────────────────────────────────────
function VideoPlayerModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <p className="absolute -top-10 left-0 text-sm text-white/70 truncate max-w-[80%]">
          {title}
        </p>
        <video
          src={url}
          controls
          autoPlay
          className="w-full rounded-xl bg-black max-h-[80vh]"
        />
      </div>
    </div>
  );
}

// ── Posts Table ──────────────────────────────────────────────────
const POLL_INTERVAL = 8000;

function PostsTable({ campaignId }: { campaignId: number }) {
  const [tab, setTab] = useState<"queued" | "published">("queued");
  const [posts, setPosts] = useState<CampaignPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postsRef = useRef<string>("");

  const fetchPosts = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const result = await adminAPI.getCampaignPosts(campaignId, {
          tab,
          page,
          pageSize: 10,
          sortBy: tab === "published" ? "posted_time" : "created_at",
          sortOrder: "desc",
        });
        // Only update state when data actually changed to prevent video element remounts
        const postsJson = JSON.stringify(result.posts);
        if (postsJson !== postsRef.current) {
          postsRef.current = postsJson;
          setPosts(result.posts);
        }
        setTotalPosts(result.pagination.totalPosts);
        setTotalPages(result.pagination.totalPages);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [campaignId, tab, page],
  );

  // Initial fetch + refetch on tab/page change
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Auto-poll both tabs (queued: processing→scheduled, published: new posts appear)
  useEffect(() => {
    pollRef.current = setInterval(() => fetchPosts(true), POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchPosts]);

  const tabs = [
    { key: "queued" as const, label: "Queued Posts" },
    { key: "published" as const, label: "Published Posts" },
  ];

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      {/* Tab bar */}
      <div className="px-6 pt-4 pb-0 border-b border-border flex items-center gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-emerald text-emerald"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-text-tertiary pb-2">
          {totalPosts} post{totalPosts !== 1 ? "s" : ""}
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
            Live
          </span>
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-text-secondary">
          Loading posts...
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center text-text-tertiary">
          {tab === "queued"
            ? "No queued posts yet. Publish a video to see posts here."
            : "No published posts yet."}
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-surface-elevated border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                Video
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                Platform
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                Status
              </th>
              {tab === "published" && (
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Account
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                {tab === "queued" ? "Created" : "Published"}
              </th>
              {tab === "published" && (
                <th className="px-6 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Link
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.map((post) => {
              const statusStyle = getPostStatusStyle(post.status);
              return (
                <tr
                  key={post.id}
                  className="hover:bg-surface-hover/50 transition-colors"
                >
                  {/* Video */}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      {post.clip_url ? (
                        <button
                          onClick={() =>
                            setPlayingVideo({
                              url: post.clip_url!,
                              title: post.clip_title || `Post #${post.id}`,
                            })
                          }
                          className="relative group w-16 h-10 rounded overflow-hidden bg-black flex-shrink-0"
                        >
                          <video
                            src={post.clip_url}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </button>
                      ) : (
                        <div className="w-16 h-10 rounded bg-surface-elevated flex-shrink-0" />
                      )}
                      <span className="text-sm text-text-primary truncate max-w-[200px]">
                        {post.clip_title || post.content || `Post #${post.id}`}
                      </span>
                    </div>
                  </td>
                  {/* Platform */}
                  <td className="px-6 py-3">
                    <PlatformChip platform={post.platform} />
                  </td>
                  {/* Status */}
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${statusStyle.class}`}
                    >
                      {post.status === "processing" && (
                        <svg
                          className="w-3 h-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      )}
                      {statusStyle.label}
                    </span>
                  </td>
                  {/* Account (published only) */}
                  {tab === "published" && (
                    <td className="px-6 py-3">
                      <span className="text-sm text-text-secondary">
                        {post.accountHandle ? `@${post.accountHandle}` : "—"}
                      </span>
                    </td>
                  )}
                  {/* Date */}
                  <td className="px-6 py-3">
                    <span className="text-sm text-text-tertiary">
                      {new Date(
                        tab === "published" && post.posted_time
                          ? post.posted_time
                          : post.created_at,
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  {/* Link (published only) */}
                  {tab === "published" && (
                    <td className="px-6 py-3">
                      {post.post_url ? (
                        <a
                          href={post.post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-emerald hover:underline inline-flex items-center gap-1"
                        >
                          View
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-xs text-text-tertiary">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-text-tertiary">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg bg-surface-elevated border border-border text-text-secondary text-xs hover:bg-surface-hover disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg bg-surface-elevated border border-border text-text-secondary text-xs hover:bg-surface-hover disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Video Player */}
      {playingVideo && (
        <VideoPlayerModal
          url={playingVideo.url}
          title={playingVideo.title}
          onClose={() => setPlayingVideo(null)}
        />
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function CampaignPublishPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = Number(params.id);

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [videos, setVideos] = useState<CampaignVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videoFilter, setVideoFilter] = useState<
    "all" | "unpublished" | "published"
  >("all");
  const [videoPage, setVideoPage] = useState(1);
  const [videoTotalPages, setVideoTotalPages] = useState(1);
  const [videoTotalCount, setVideoTotalCount] = useState(0);

  const [publishingVideo, setPublishingVideo] = useState<CampaignVideo | null>(
    null,
  );
  const [bulkPublishClips, setBulkPublishClips] = useState<
    { clipId: number; title: string }[] | null
  >(null);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<number>>(
    new Set(),
  );
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Key to force PostsTable remount after publishing
  const [postsKey, setPostsKey] = useState(0);

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const { campaign: c } = await adminAPI.getCampaign(campaignId);
        setCampaign(c);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load campaign",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchCampaign();
  }, [campaignId]);

  const fetchVideos = useCallback(
    async (pg?: number) => {
      if (!campaign || campaign.status !== "started") return;
      setVideosLoading(true);
      try {
        const result = await adminAPI.getCampaignVideos(campaignId, {
          page: pg ?? videoPage,
          pageSize: 10,
          filter: videoFilter,
        });
        setVideos(result.videos);
        setVideoTotalPages(result.pagination.totalPages);
        setVideoTotalCount(result.pagination.totalVideos);
      } catch {
        /* silent */
      } finally {
        setVideosLoading(false);
      }
    },
    [campaign, campaignId, videoPage, videoFilter],
  );

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const toggleClipSelection = (clipId: number) => {
    setSelectedClipIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  };

  // Shared per-clip publish function — calls API, returns number of posts queued
  const publishOneClip = async (
    clipId: number,
    platformQty: Record<string, number>,
    scramblingLevel: "light" | "heavy",
  ) => {
    const { postIds } = await adminAPI.postCampaignClip(
      campaignId,
      clipId,
      platformQty,
      scramblingLevel,
    );
    return postIds.length;
  };

  // Called when modal finishes (single or bulk) — handles cleanup and toast
  const handlePublishComplete = (totalQueued: number, failed: number) => {
    const msg =
      failed > 0
        ? `Queued ${totalQueued} posts (${failed} video${failed !== 1 ? "s" : ""} failed)`
        : `Queued ${totalQueued} post${totalQueued !== 1 ? "s" : ""} for processing`;
    setPostSuccess(msg);
    setPublishingVideo(null);
    setBulkPublishClips(null);
    setSelectedClipIds(new Set());
    setPostsKey((k) => k + 1);
    fetchVideos();
  };

  const handleBulkPublish = () => {
    const clips = videos
      .filter((v) => v.clip_id && selectedClipIds.has(v.clip_id))
      .map((v) => ({
        clipId: v.clip_id!,
        title: v.title ?? v.file_name ?? `Video #${v.id}`,
      }));
    if (clips.length === 0) return;
    setBulkPublishClips(clips);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-text-secondary py-20">
          Loading campaign...
        </div>
      </div>
    );
  }
  if (!campaign) {
    return (
      <div className="p-8">
        <div className="text-center text-red-400 py-20">
          {error || "Campaign not found"}
        </div>
      </div>
    );
  }
  if (campaign.status !== "started") {
    return (
      <div className="p-8">
        <button
          onClick={() => router.push("/dashboard/publish")}
          className="text-sm text-text-secondary hover:text-text-primary mb-6 inline-flex items-center gap-1"
        >
          &larr; Back
        </button>
        <div className="text-center text-text-tertiary py-20">
          Campaign is not active (status: {campaign.status}). Only started
          campaigns can publish.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/dashboard/publish")}
          className="text-sm text-text-secondary hover:text-text-primary mb-4 inline-flex items-center gap-1"
        >
          &larr; Back to Publish
        </button>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Publish Videos
            </h1>
            <p className="text-text-secondary mt-1">
              {campaign.team_name} &middot; {campaign.name}
            </p>
          </div>
          <span
            className={`inline-block px-2.5 py-1 text-xs rounded-lg border ${getStatusBadgeClass(campaign.status)} capitalize`}
          >
            {campaign.status}
          </span>
        </div>
      </div>

      {/* Info bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
            Budget
          </div>
          <div className="text-lg font-bold text-text-primary">
            {campaign.budget
              ? `$${Number(campaign.budget).toLocaleString()}`
              : "—"}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
            CPM Rate
          </div>
          <div className="text-lg font-bold text-text-primary">
            {campaign.quoted_cpm
              ? `$${Number(campaign.quoted_cpm).toFixed(2)}`
              : "—"}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
            Video Min
          </div>
          <div className="text-lg font-bold text-text-primary">
            {campaign.video_minimum ?? "—"}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1">
            Videos
          </div>
          <div className="text-lg font-bold text-text-primary">
            {videosLoading ? "..." : videoTotalCount}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="text-red-300 hover:text-red-200 ml-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
      {postSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center justify-between">
          <span>{postSuccess}</span>
          <button
            onClick={() => setPostSuccess(null)}
            className="text-green-300 hover:text-green-200 ml-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Google Drive */}
      {campaign.google_drive_folder_id && (
        <div className="mb-6">
          <a
            href={`https://drive.google.com/drive/folders/${campaign.google_drive_folder_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-sm text-emerald hover:bg-surface-hover transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Open Google Drive Folder
          </a>
        </div>
      )}

      {/* Videos list */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Select all checkbox */}
            {(() => {
              const publishable = videos.filter((v) => v.clip_id != null);
              const allSelected =
                publishable.length > 0 &&
                publishable.every((v) => selectedClipIds.has(v.clip_id!));
              const someSelected = publishable.some((v) =>
                selectedClipIds.has(v.clip_id!),
              );
              return publishable.length > 0 ? (
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={() => {
                    if (allSelected) {
                      setSelectedClipIds(new Set());
                    } else {
                      setSelectedClipIds(
                        new Set(publishable.map((v) => v.clip_id!)),
                      );
                    }
                  }}
                  className="w-4 h-4 rounded border-border text-emerald focus:ring-emerald cursor-pointer accent-emerald"
                />
              ) : null;
            })()}
            <h2 className="text-sm font-semibold text-text-primary">
              Campaign Videos
            </h2>
            <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-0.5">
              {(["all", "unpublished", "published"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setVideoFilter(f);
                    setVideoPage(1);
                    setSelectedClipIds(new Set());
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                    videoFilter === f
                      ? "bg-surface text-text-primary shadow-sm"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedClipIds.size > 0 && (
              <>
                <span className="text-xs font-semibold text-emerald">
                  {selectedClipIds.size} selected
                </span>
                <button
                  onClick={handleBulkPublish}
                  className="px-3 py-1.5 rounded-lg bg-emerald text-black text-xs font-semibold hover:bg-emerald-light transition-colors"
                >
                  Publish Selected
                </button>
              </>
            )}
            <button
              onClick={() => fetchVideos()}
              disabled={videosLoading}
              className="text-xs text-text-tertiary hover:text-text-secondary disabled:opacity-50"
            >
              {videosLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {videosLoading && videos.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            Loading videos...
          </div>
        ) : videos.length === 0 ? (
          <div className="p-12 text-center text-text-tertiary">
            No videos in this campaign yet.
          </div>
        ) : (
          (() => {
            return videos.length === 0 ? (
              <div className="p-12 text-center text-text-tertiary">
                No {videoFilter} videos.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className={`px-6 py-4 flex items-center gap-4 transition-colors ${video.clip_id && selectedClipIds.has(video.clip_id) ? "bg-emerald/5" : "hover:bg-surface-hover/50"}`}
                  >
                    {/* Checkbox */}
                    {video.clip_id ? (
                      <input
                        type="checkbox"
                        checked={selectedClipIds.has(video.clip_id)}
                        onChange={() => toggleClipSelection(video.clip_id!)}
                        className="w-4 h-4 rounded border-border text-emerald focus:ring-emerald flex-shrink-0 cursor-pointer accent-emerald"
                      />
                    ) : (
                      <div className="w-4 h-4 flex-shrink-0" />
                    )}
                    {video.presigned_url ? (
                      <button
                        onClick={() =>
                          setPlayingVideo({
                            url: video.presigned_url!,
                            title:
                              video.title ??
                              video.file_name ??
                              `Video #${video.id}`,
                          })
                        }
                        className="relative group w-24 h-14 rounded-lg overflow-hidden bg-black flex-shrink-0"
                      >
                        <video
                          src={video.presigned_url}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </button>
                    ) : (
                      <div className="w-24 h-14 rounded-lg bg-surface-elevated flex-shrink-0 flex items-center justify-center text-text-tertiary text-xs">
                        No preview
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {video.title ??
                            video.file_name ??
                            `Video #${video.id}`}
                        </p>
                        {video.post_count > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-500/10 border border-green-500/20 text-green-400 flex-shrink-0">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Published ({video.post_count})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {video.clip_id && (
                          <span className="text-xs text-text-tertiary">
                            Clip #{video.clip_id}
                          </span>
                        )}
                        {video.duration_seconds != null && (
                          <span className="text-xs text-text-tertiary">
                            {Math.floor(video.duration_seconds / 60)}:
                            {String(
                              Math.floor(video.duration_seconds % 60),
                            ).padStart(2, "0")}
                          </span>
                        )}
                      </div>
                    </div>
                    {video.clip_id ? (
                      <button
                        onClick={() => setPublishingVideo(video)}
                        className="px-4 py-2 rounded-lg bg-emerald/10 border border-emerald/20 text-emerald text-sm font-medium hover:bg-emerald/20 transition-colors flex-shrink-0"
                      >
                        Publish
                      </button>
                    ) : (
                      <span className="text-xs text-text-tertiary flex-shrink-0">
                        No clip linked
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })()
        )}

        {/* Video Pagination */}
        {videoTotalPages > 1 && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-text-tertiary">
              Page {videoPage} of {videoTotalPages} ({videoTotalCount} videos)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setVideoPage((p) => Math.max(1, p - 1));
                  setSelectedClipIds(new Set());
                }}
                disabled={videoPage === 1}
                className="px-3 py-1 rounded-lg bg-surface-elevated border border-border text-text-secondary text-xs hover:bg-surface-hover disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => {
                  setVideoPage((p) => Math.min(videoTotalPages, p + 1));
                  setSelectedClipIds(new Set());
                }}
                disabled={videoPage === videoTotalPages}
                className="px-3 py-1 rounded-lg bg-surface-elevated border border-border text-text-secondary text-xs hover:bg-surface-hover disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Posts Table */}
      <PostsTable key={postsKey} campaignId={campaignId} />

      {/* Single Publish Modal */}
      {publishingVideo && publishingVideo.clip_id && (
        <PublishModal
          clips={[
            {
              clipId: publishingVideo.clip_id,
              title:
                publishingVideo.title ??
                publishingVideo.file_name ??
                `Video #${publishingVideo.id}`,
            },
          ]}
          onClose={() => setPublishingVideo(null)}
          onPublishClip={publishOneClip}
          onComplete={handlePublishComplete}
        />
      )}

      {/* Bulk Publish Modal */}
      {bulkPublishClips && bulkPublishClips.length > 0 && (
        <PublishModal
          clips={bulkPublishClips}
          onClose={() => setBulkPublishClips(null)}
          onPublishClip={publishOneClip}
          onComplete={handlePublishComplete}
        />
      )}

      {/* Video Player */}
      {playingVideo && (
        <VideoPlayerModal
          url={playingVideo.url}
          title={playingVideo.title}
          onClose={() => setPlayingVideo(null)}
        />
      )}
    </div>
  );
}
