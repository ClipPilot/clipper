"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Button,
  Chip,
  Modal,
  toast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import {
  campaignAPI,
  type Campaign,
  type CampaignVideo,
  type CampaignWallet,
  type CampaignCard,
} from "@/api/campaign";
import { adPostingAPI } from "@/api/adPosting";
import type { TeamPost } from "@/types/massPosting";
import { CampaignInfoBar } from "./CampaignInfoBar";
import { VideoPreviewModal } from "../shared/VideoPreviewModal";
import { ClipPickerModal } from "../shared/ClipPickerModal";
import { BulkUploadModal } from "../shared/BulkUploadModal";
import { SetupModal } from "../gates/PaymentGate";
import { useBulkVideoUpload } from "@/hooks/useBulkVideoUpload";
import { AccountsTab } from "@/components/mass-posting/dashboard/AccountsTab";
import { BillingTab } from "./BillingTab";
import {
  platformIcon,
  platformIconColor,
  platformDisplayName,
  platformChipClass,
} from "@/lib/platformUtils";

// ── Props ────────────────────────────────────────────────────────────────────

interface ActiveCampaignDashboardProps {
  campaign: Campaign;
  videos: CampaignVideo[];
  wallet: CampaignWallet | null;
  savedCard: CampaignCard | null;
  onBack: () => void;
  onVideoAdded: (video: CampaignVideo) => void;
  onVideosAdded: (videos: CampaignVideo[]) => void;
  onCampaignUpdated: (campaign: Campaign) => void;
  onRefetchVideos: (sortBy?: string, sortOrder?: string) => Promise<void>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getPostStatusStyle(status: string) {
  const styles: Record<string, { className: string; label: string }> = {
    waiting_assignment: { className: "bg-default-500/10 border-default-500/20 text-default-400", label: "Waiting Assignment" },
    in_drive: { className: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400", label: "In Drive" },
    published: { className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", label: "Published" },
    pending: { className: "bg-amber-500/10 border-amber-500/20 text-amber-400", label: "Awaiting Platforms" },
    processing: { className: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400", label: "Processing" },
    scheduled: { className: "bg-violet-500/10 border-violet-500/20 text-violet-400", label: "Scheduled" },
    posted: { className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", label: "Published" },
    failed: { className: "bg-red-500/10 border-red-500/20 text-red-400", label: "Failed" },
  };
  return styles[status] || styles.waiting_assignment;
}

export function ActiveCampaignDashboard({
  campaign,
  videos,
  wallet,
  savedCard,
  onBack,
  onVideoAdded,
  onVideosAdded,
  onCampaignUpdated,
  onRefetchVideos,
}: ActiveCampaignDashboardProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);

  // Tab state
  const [activeTab, setActiveTab] = useState<"queued" | "accounts" | "published" | "billing">("queued");
  const [dateRange, setDateRange] = useState("mtd");

  // Sort state
  const [sortBy, setSortBy] = useState<"created_at" | "title" | "publish_status" | "post_count">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Video pagination state (queued tab)
  const [paginatedVideos, setPaginatedVideos] = useState<CampaignVideo[]>([]);
  const [videoPage, setVideoPage] = useState(1);
  const [videoTotalPages, setVideoTotalPages] = useState(1);
  const [videoTotalCount, setVideoTotalCount] = useState(0);
  const [videosLoading, setVideosLoading] = useState(true);

  // Posts table state (published tab)
  const [posts, setPosts] = useState<TeamPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [postsPage, setPostsPage] = useState(1);
  const [postsLoading, setPostsLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null);

  // Video management state
  const [previewVideo, setPreviewVideo] = useState<CampaignVideo | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const bulk = useBulkVideoUpload(selectedTeam?.id, campaign.id, onVideoAdded);

  // End campaign state
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Billing setup state
  const [currentCard, setCurrentCard] = useState<CampaignCard | null>(savedCard);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  useEffect(() => {
    setCurrentCard(savedCard);
  }, [savedCard]);

  const PAGE_SIZE = 20;

  const fetchVideos = useCallback(async (page = 1, { silent = false } = {}) => {
    if (!selectedTeam?.id) return;
    if (!silent) setVideosLoading(true);
    try {
      const result = await campaignAPI.listVideos(selectedTeam.id, campaign.id, {
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder,
        filter: "queued",
      });
      setPaginatedVideos(result.videos);
      setVideoTotalPages(result.pagination.totalPages);
      setVideoTotalCount(result.pagination.totalVideos);
    } catch (err) {
      console.error("Failed to fetch videos:", err);
    } finally {
      if (!silent) setVideosLoading(false);
    }
  }, [selectedTeam?.id, campaign.id, sortBy, sortOrder]);

  useEffect(() => {
    if (activeTab === "queued") {
      fetchVideos(videoPage);
    }
  }, [fetchVideos, activeTab, videoPage]);

  const handleSort = useCallback((column: "created_at" | "title" | "publish_status" | "post_count") => {
    const newOrder = sortBy === column && sortOrder === "desc" ? "asc" : "desc";
    setSortBy(column);
    setSortOrder(newOrder);
    setVideoPage(1);
  }, [sortBy, sortOrder]);

  const fetchPosts = useCallback(async (page = 1) => {
    if (!selectedTeam?.id || activeTab !== "published") return;
    setPostsLoading(true);
    try {
      const result = await adPostingAPI.getTeamPosts(selectedTeam.id, {
        tab: "published",
        page,
        pageSize: PAGE_SIZE,
        sortBy: "posted_time",
        sortOrder: "desc",
        campaignId: campaign.id,
        groupByVideo: true,
      });
      setPosts(result.posts);
      setTotalPosts(result.pagination.totalPosts);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setPostsLoading(false);
    }
  }, [selectedTeam?.id, activeTab, campaign.id]);

  useEffect(() => {
    if (activeTab === "published") {
      fetchPosts(postsPage);
    }
  }, [fetchPosts, activeTab, postsPage]);

  // Group posts by clip_id (unique video)
  interface VideoGroup {
    clipId: number | null;
    clipTitle: string | null;
    clipUrl: string | null;
    posts: TeamPost[];
    platforms: Record<string, number>;
    earliestDate: string;
    statuses: string[];
  }

  const videoGroups = useMemo(() => {
    if (activeTab === "queued") {
      return paginatedVideos.map((video) => ({
        clipId: video.clip_id,
        clipTitle: video.title || video.file_name || `Video #${video.id}`,
        clipUrl: video.presigned_url,
        posts: [] as TeamPost[],
        platforms: {} as Record<string, number>,
        earliestDate: video.created_at,
        statuses: [video.publish_status],
      } as VideoGroup));
    }

    const filtered = posts.filter((p) => p.status !== "failed");
    const map = new Map<string, VideoGroup>();
    for (const post of filtered) {
      const key = String(post.clip_id ?? `no-clip-${post.id}`);
      let group = map.get(key);
      if (!group) {
        group = {
          clipId: post.clip_id,
          clipTitle: post.clip_title,
          clipUrl: post.clip_url,
          posts: [],
          platforms: {},
          earliestDate: post.created_at,
          statuses: [],
        };
        map.set(key, group);
      }
      group.posts.push(post);
      group.platforms[post.platform] = (group.platforms[post.platform] || 0) + 1;
      group.statuses.push(post.status);
    }

    return Array.from(map.values());
  }, [posts, activeTab, paginatedVideos]);

  // Existing clip IDs for the picker filter
  const existingClipIds = new Set(
    videos.filter((v) => v.clip_id != null).map((v) => v.clip_id as number),
  );

  const handleEndCampaign = async () => {
    if (!selectedTeam?.id) return;
    setIsEnding(true);
    try {
      const { campaign: updated } = await campaignAPI.endCampaign(
        selectedTeam.id,
        campaign.id,
      );
      toast.success("Campaign ended", { description: "Campaign ended successfully." });
      setIsEndModalOpen(false);
      onCampaignUpdated(updated);
    } catch (err: any) {
      toast.danger("Failed to end campaign", { description: err.message || "Something went wrong" });
    } finally {
      setIsEnding(false);
    }
  };

  // ── Billing handlers ────────────────────────────────────────────────────────

  const handleChangeBilling = async () => {
    if (!selectedTeam?.id) return;
    setIsSettingUp(true);
    try {
      const { clientSecret: cs } = await campaignAPI.createSetupIntent(
        selectedTeam.id,
        campaign.id,
      );
      setSetupSecret(cs);
      setIsSetupModalOpen(true);
    } catch (err: any) {
      toast.danger("Failed to start card setup", { description: err.message || "Something went wrong" });
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleCardSaved = (newCard: CampaignCard) => {
    setCurrentCard(newCard);
    setIsSetupModalOpen(false);
    setSetupSecret(null);
  };

  // ── Contract handler ──────────────────────────────────────────────────────

  const handleViewContract = async () => {
    if (!selectedTeam?.id) return;
    try {
      const { agreement } = await campaignAPI.getMasterAgreement(
        selectedTeam.id,
      );
      if (agreement?.presigned_pdf_url) {
        window.open(agreement.presigned_pdf_url, "_blank", "noopener,noreferrer");
      } else {
        toast.warning("Contract not available", { description: "No PDF is attached to this contract yet." });
      }
    } catch (err: any) {
      toast.danger("Failed to load contract", { description: err.message || "Something went wrong" });
    }
  };


  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back nav */}
        <Button
 variant="ghost"
 size="sm"
 className="text-text-secondary -ml-2 !bg-transparent"
 onPress={onBack}
 >
          <Icon icon="solar:arrow-left-linear" width={16} />
          Back to Campaigns
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-2xl font-bold text-text-primary truncate">
              {campaign.name}
            </h1>
            <Chip
              size="sm"
              className={`flex-shrink-0 capitalize ${
                campaign.status === "started" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
              }`}
            >
              {campaign.status === "started" ? "Live" : campaign.status}
            </Chip>
          </div>
          <Button
 variant="danger-soft"
 size="sm"
 onPress={() => setIsEndModalOpen(true)}
 >
            <Icon icon="solar:stop-circle-bold" width={16} />
            End Campaign
          </Button>
        </div>

        {/* Info bar */}
        <CampaignInfoBar
          campaign={campaign}
          wallet={wallet}
          savedCard={currentCard}
          onChangeBilling={handleChangeBilling}
          onViewContract={handleViewContract}
        />

        <div className="flex gap-1 border-b border-border-base mb-6">
          {([
            { id: "queued", label: "Queued Posts", count: activeTab === "queued" && videoTotalCount > 0 ? videoTotalCount : null },
            { id: "accounts", label: "Accounts", count: null },
            { id: "published", label: "Published Posts", count: activeTab === "published" && videoGroups.length > 0 ? totalPosts : null },
            { id: "billing", label: "Billing", count: null },
          ] as const).map((tab) => (
            <div
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPostsPage(1); setVideoPage(1); }}
              className={`px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-accent-400 text-accent-400"
                  : "border-transparent text-text-tertiary hover:text-text-primary"
              }`}
            >
              <div className="flex items-center gap-2">
                {tab.label}
                {tab.count != null && (
                  <span className="text-xs bg-accent-400/15 text-accent-400 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {activeTab === "queued" && (
          <div>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-end">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="tertiary"
                    className="bg-white/[0.04] text-text-secondary h-9"
                    onPress={() => setIsPickerOpen(true)}
                  >
                    <Icon icon="solar:library-bold-duotone" width={14} />
                    Add from Library
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-9"
                    onPress={() => setIsUploadOpen(true)}
                  >
                    <Icon icon="solar:upload-bold-duotone" width={14} />
                    Upload Videos
                  </Button>
                </div>
              </div>

              <div className="bg-surface-base border border-border-base rounded-2xl overflow-hidden">
                <div className="px-6 py-3 border-b border-border-base flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">Campaign Videos</span>
                  <span className="text-xs text-text-secondary">
                    {videoTotalCount} video{videoTotalCount !== 1 ? "s" : ""}
                  </span>
                </div>

                {videosLoading ? (
                  <div className="p-12 text-center text-text-secondary">Loading...</div>
                ) : videoGroups.length === 0 ? (
                  <div className="p-12 text-center text-text-secondary">
                    No videos in this campaign yet. Add videos to get started.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-white/[0.04] border-b border-border-base">
                      <tr>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none"
                          onClick={() => handleSort("title")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Video
                            {sortBy === "title" && <Icon icon={sortOrder === "asc" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} />}
                          </span>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Platforms</th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none"
                          onClick={() => handleSort("post_count")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Posts
                            {sortBy === "post_count" && <Icon icon={sortOrder === "asc" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} />}
                          </span>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none"
                          onClick={() => handleSort("publish_status")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Status
                            {sortBy === "publish_status" && <Icon icon={sortOrder === "asc" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} />}
                          </span>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none"
                          onClick={() => handleSort("created_at")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Created
                            {sortBy === "created_at" && <Icon icon={sortOrder === "asc" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} />}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base">
                      {videoGroups.map((group) => {
                        const aggregateStatus = group.statuses[0] || "waiting_assignment";
                        const statusStyle = getPostStatusStyle(aggregateStatus);
                        return (
                          <tr key={group.clipId ?? group.posts[0]?.id} className="hover:bg-white/[0.04] transition-colors">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                {group.clipUrl ? (
                                  <div
                                    onClick={() => setPlayingVideo({ url: group.clipUrl!, title: group.clipTitle || "Video" })}
                                    className="relative group w-16 h-10 rounded overflow-hidden bg-black flex-shrink-0 cursor-pointer"
                                  >
                                    <video src={group.clipUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                      <Icon icon="solar:play-bold" className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-16 h-10 rounded bg-white/[0.04] flex-shrink-0" />
                                )}
                                <span className="text-sm text-text-primary truncate max-w-[200px]">
                                  {group.clipTitle || `Video #${group.clipId}`}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              {Object.keys(group.platforms).length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(group.platforms).map(([platform, count]) => (
                                    <span
                                      key={platform}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${platformChipClass(platform)}`}
                                    >
                                      <Icon icon={platformIcon(platform)} width={12} className={platformIconColor(platform)} />
                                      {count > 1 ? `${platformDisplayName(platform)} x${count}` : platformDisplayName(platform)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-text-secondary italic">No platforms yet</span>
                              )}
                            </td>
                            <td className="px-6 py-3">
                              <span className="text-sm text-text-secondary">{group.posts.length || "\u2014"}</span>
                            </td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${statusStyle.className}`}>
                                {aggregateStatus === "processing" && (
                                  <Icon icon="solar:refresh-bold" className="w-3 h-3 animate-spin" />
                                )}
                                {statusStyle.label}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <span className="text-sm text-text-secondary">
                                {new Date(group.earliestDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {videoTotalPages > 1 && (
                  <div className="px-6 py-3 border-t border-border-base flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Page {videoPage} of {videoTotalPages}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="tertiary"
                        className="bg-white/[0.04] text-text-secondary h-7 text-xs"
                        isDisabled={videoPage === 1}
                        onPress={() => setVideoPage(Math.max(1, videoPage - 1))}
                      >
                        Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="tertiary"
                        className="bg-white/[0.04] text-text-secondary h-7 text-xs"
                        isDisabled={videoPage === videoTotalPages}
                        onPress={() => setVideoPage(Math.min(videoTotalPages, videoPage + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {playingVideo && (
                <Modal>
                  <Modal.Backdrop isOpen onOpenChange={() => setPlayingVideo(null)}><Modal.Container><Modal.Dialog className="sm:max-w-2xl">
                    <Modal.Header>
                      {playingVideo.title}
                    </Modal.Header>
                    <Modal.Body className="p-0">
                      <video
                        src={playingVideo.url}
                        controls
                        autoPlay
                        className="w-full max-h-[70vh]"
                      />
                    </Modal.Body>
                  </Modal.Dialog></Modal.Container></Modal.Backdrop>
                </Modal>
              )}
            </div>
          </div>
        )}

        {activeTab === "accounts" && (
          <div>
            <div className="mt-6">
              <AccountsTab
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
          </div>
        )}

        {activeTab === "published" && (
          <div>
            <div className="mt-6 space-y-4">
              <div className="bg-surface-base border border-border-base rounded-2xl overflow-hidden">
                <div className="px-6 py-3 border-b border-border-base flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">Published Posts</span>
                  <span className="text-xs text-text-secondary">
                    {videoGroups.length} video{videoGroups.length !== 1 ? "s" : ""} &middot; {totalPosts} post{totalPosts !== 1 ? "s" : ""}
                  </span>
                </div>

                {postsLoading ? (
                  <div className="p-12 text-center text-text-secondary">Loading...</div>
                ) : videoGroups.length === 0 ? (
                  <div className="p-12 text-center text-text-secondary">
                    No published posts yet.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-white/[0.04] border-b border-border-base">
                      <tr>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none"
                          onClick={() => handleSort("title")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Video
                            {sortBy === "title" && <Icon icon={sortOrder === "asc" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} />}
                          </span>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Platforms</th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none"
                          onClick={() => handleSort("post_count")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Posts
                            {sortBy === "post_count" && <Icon icon={sortOrder === "asc" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} />}
                          </span>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none"
                          onClick={() => handleSort("publish_status")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Status
                            {sortBy === "publish_status" && <Icon icon={sortOrder === "asc" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} />}
                          </span>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none"
                          onClick={() => handleSort("created_at")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Published
                            {sortBy === "created_at" && <Icon icon={sortOrder === "asc" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} />}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base">
                      {videoGroups.map((group) => {
                        const aggregateStatus = group.statuses.includes("processing") ? "processing"
                          : group.statuses.every((s) => s === "posted") ? "posted"
                          : "scheduled";
                        const statusStyle = getPostStatusStyle(aggregateStatus);
                        return (
                          <tr key={group.clipId ?? group.posts[0]?.id} className="hover:bg-white/[0.04] transition-colors">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                {group.clipUrl ? (
                                  <div
                                    onClick={() => setPlayingVideo({ url: group.clipUrl!, title: group.clipTitle || "Video" })}
                                    className="relative group w-16 h-10 rounded overflow-hidden bg-black flex-shrink-0 cursor-pointer"
                                  >
                                    <video src={group.clipUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                      <Icon icon="solar:play-bold" className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-16 h-10 rounded bg-white/[0.04] flex-shrink-0" />
                                )}
                                <span className="text-sm text-text-primary truncate max-w-[200px]">
                                  {group.clipTitle || `Video #${group.clipId}`}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              {Object.keys(group.platforms).length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(group.platforms).map(([platform, count]) => (
                                    <span
                                      key={platform}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${platformChipClass(platform)}`}
                                    >
                                      <Icon icon={platformIcon(platform)} width={12} className={platformIconColor(platform)} />
                                      {count > 1 ? `${platformDisplayName(platform)} x${count}` : platformDisplayName(platform)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-text-secondary italic">No platforms yet</span>
                              )}
                            </td>
                            <td className="px-6 py-3">
                              <span className="text-sm text-text-secondary">{group.posts.length || "\u2014"}</span>
                            </td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${statusStyle.className}`}>
                                {aggregateStatus === "processing" && (
                                  <Icon icon="solar:refresh-bold" className="w-3 h-3 animate-spin" />
                                )}
                                {statusStyle.label}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <span className="text-sm text-text-secondary">
                                {new Date(group.earliestDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {totalPages > 1 && (
                  <div className="px-6 py-3 border-t border-border-base flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Page {postsPage} of {totalPages}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="tertiary"
                        className="bg-white/[0.04] text-text-secondary h-7 text-xs"
                        isDisabled={postsPage === 1}
                        onPress={() => setPostsPage(Math.max(1, postsPage - 1))}
                      >
                        Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="tertiary"
                        className="bg-white/[0.04] text-text-secondary h-7 text-xs"
                        isDisabled={postsPage === totalPages}
                        onPress={() => setPostsPage(Math.min(totalPages, postsPage + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {playingVideo && (
                <Modal>
                  <Modal.Backdrop isOpen onOpenChange={() => setPlayingVideo(null)}><Modal.Container><Modal.Dialog className="sm:max-w-2xl">
                    <Modal.Header>
                      {playingVideo.title}
                    </Modal.Header>
                    <Modal.Body className="p-0">
                      <video
                        src={playingVideo.url}
                        controls
                        autoPlay
                        className="w-full max-h-[70vh]"
                      />
                    </Modal.Body>
                  </Modal.Dialog></Modal.Container></Modal.Backdrop>
                </Modal>
              )}
            </div>
          </div>
        )}

        {activeTab === "billing" && (
          <div>
            <div className="mt-6">
              <BillingTab campaign={campaign} />
            </div>
          </div>
        )}
      </div>

      {/* Bulk upload modal */}
      <BulkUploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          fetchVideos(videoPage, { silent: true });
        }}
        files={bulk.files}
        isActive={bulk.isActive}
        totalFiles={bulk.totalFiles}
        completedFiles={bulk.completedFiles}
        failedFiles={bulk.failedFiles}
        onStartUpload={bulk.startUpload}
        onReset={bulk.reset}
      />

      {/* Clip picker modal */}
      {selectedTeam?.id && (
        <ClipPickerModal
          isOpen={isPickerOpen}
          onClose={() => {
            setIsPickerOpen(false);
            fetchVideos(videoPage, { silent: true });
          }}
          teamId={selectedTeam.id}
          campaignId={campaign.id}
          existingClipIds={existingClipIds}
          onAdded={onVideosAdded}
        />
      )}

      {/* Video preview modal */}
      <VideoPreviewModal
        video={previewVideo}
        isOpen={previewVideo !== null}
        onClose={() => setPreviewVideo(null)}
      />

      {/* End campaign confirmation modal */}
      <Modal>
        <Modal.Backdrop isOpen={isEndModalOpen} onOpenChange={() => setIsEndModalOpen(false)}><Modal.Container><Modal.Dialog className="sm:max-w-md">
          <Modal.Header>
            <div className="flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold-duotone" className="text-red-500" width={20} />
              <span className="text-text-primary">End Campaign</span>
            </div>
          </Modal.Header>
          <Modal.Body className="py-4">
            <p className="text-sm text-text-secondary">
              Are you sure you want to end this campaign? This action will stop all posting
              and mark the campaign as completed. This cannot be undone.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button
 variant="tertiary"
 className="bg-white/[0.04] text-text-secondary"
 onPress={() => setIsEndModalOpen(false)}
 isDisabled={isEnding}
 >
              Cancel
            </Button>
            <Button variant="danger"
 onPress={handleEndCampaign}
 isPending={isEnding}
 >
              End Campaign
            </Button>
          </Modal.Footer>
        </Modal.Dialog></Modal.Container></Modal.Backdrop>
      </Modal>

      {/* Card setup modal (billing change) */}
      <SetupModal
        isOpen={isSetupModalOpen}
        onClose={() => {
          setIsSetupModalOpen(false);
          setSetupSecret(null);
        }}
        clientSecret={setupSecret}
        teamId={selectedTeam?.id ?? 0}
        campaignId={campaign.id}
        onSaved={handleCardSaved}
      />
    </div>
  );
}
