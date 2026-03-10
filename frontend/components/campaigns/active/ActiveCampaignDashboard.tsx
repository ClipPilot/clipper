"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Button,
  Chip,
  Tabs,
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  addToast,
} from "@heroui/react";
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
    waiting_assignment: { className: "bg-default-500/10 border-default-500/20 text-default-500", label: "Waiting Assignment" },
    in_drive: { className: "bg-primary-500/10 border-primary-500/20 text-primary-500", label: "In Drive" },
    published: { className: "bg-success-500/10 border-success-500/20 text-success-500", label: "Published" },
    // Legacy post-level statuses (used by published tab)
    pending: { className: "bg-default-500/10 border-default-500/20 text-default-500", label: "Awaiting Platforms" },
    processing: { className: "bg-warning-500/10 border-warning-500/20 text-warning-500", label: "Processing" },
    scheduled: { className: "bg-primary-500/10 border-primary-500/20 text-primary-500", label: "In Drive" },
    posted: { className: "bg-success-500/10 border-success-500/20 text-success-500", label: "Published" },
    failed: { className: "bg-danger-500/10 border-danger-500/20 text-danger-500", label: "Failed" },
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
  const [activeTab, setActiveTab] = useState<"queued" | "accounts" | "published">("queued");
  const [dateRange, setDateRange] = useState("mtd");

  // Sort state
  const [sortBy, setSortBy] = useState<"created_at" | "title" | "publish_status" | "post_count">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Posts table state (single fetch, tab drives queued vs published)
  const [posts, setPosts] = useState<TeamPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
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

  // Derive the API tab from the active UI tab
  const postsTab = activeTab === "published" ? "published" : "queued";

  const handleSort = useCallback((column: "created_at" | "title" | "publish_status" | "post_count") => {
    const newOrder = sortBy === column && sortOrder === "desc" ? "asc" : "desc";
    setSortBy(column);
    setSortOrder(newOrder);
    onRefetchVideos(column, newOrder);
  }, [sortBy, sortOrder, onRefetchVideos]);

  // Fetch ALL posts for this campaign+tab (no pagination on API, we paginate grouped videos client-side)
  const fetchPosts = useCallback(async () => {
    if (!selectedTeam?.id || activeTab === "accounts") return;
    setPostsLoading(true);
    try {
      const result = await adPostingAPI.getTeamPosts(selectedTeam.id, {
        tab: postsTab,
        pageSize: 500,
        sortBy: postsTab === "published" ? "posted_time" : "created_at",
        sortOrder: "desc",
        campaignId: campaign.id,
      });
      setPosts(result.posts);
      setTotalPosts(result.pagination.totalPosts);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setPostsLoading(false);
    }
  }, [selectedTeam?.id, activeTab, postsTab, campaign.id]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
    // Filter out failed posts
    const filtered = posts.filter((p) => p.status !== "failed");

    if (postsTab === "queued") {
      // Queued tab: campaign videos are the primary data source
      // Backend provides publish_status derived from posts + user_posts chain
      const postsByClipId = new Map<number, TeamPost[]>();
      for (const post of filtered) {
        if (post.clip_id == null) continue;
        const arr = postsByClipId.get(post.clip_id) || [];
        arr.push(post);
        postsByClipId.set(post.clip_id, arr);
      }

      return videos.filter((video) => video.publish_status !== "published").map((video) => {
        const videoPosts = video.clip_id ? (postsByClipId.get(video.clip_id) || []) : [];
        const platforms: Record<string, number> = {};
        for (const p of videoPosts) {
          platforms[p.platform] = (platforms[p.platform] || 0) + 1;
        }

        return {
          clipId: video.clip_id,
          clipTitle: video.title || video.file_name || `Video #${video.id}`,
          clipUrl: video.presigned_url,
          posts: videoPosts,
          platforms,
          earliestDate: video.created_at,
          // Use backend-computed publish_status
          statuses: [video.publish_status],
        } as VideoGroup;
      });
    }

    // Published tab: posts are the primary data source (grouped by clip)
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
  }, [posts, postsTab, videos]);

  // Client-side pagination on grouped videos
  const PAGE_SIZE = 10;
  const totalVideoPages = Math.max(1, Math.ceil(videoGroups.length / PAGE_SIZE));
  const pagedGroups = videoGroups.slice((postsPage - 1) * PAGE_SIZE, postsPage * PAGE_SIZE);

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
      addToast({
        title: "Campaign ended",
        description: "Campaign ended successfully.",
        color: "success",
      });
      setIsEndModalOpen(false);
      onCampaignUpdated(updated);
    } catch (err: any) {
      addToast({
        title: "Failed to end campaign",
        description: err.message || "Something went wrong",
        color: "danger",
      });
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
      addToast({
        title: "Failed to start card setup",
        description: err.message || "Something went wrong",
        color: "danger",
      });
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
        addToast({
          title: "Contract not available",
          description: "No PDF is attached to this contract yet.",
          color: "warning",
        });
      }
    } catch (err: any) {
      addToast({
        title: "Failed to load contract",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    }
  };


  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back nav */}
        <Button
          variant="light"
          size="sm"
          className="text-text-secondary -ml-2"
          onPress={onBack}
          startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
        >
          Back to Campaigns
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-2xl font-bold text-text-primary truncate">
              {campaign.name}
            </h1>
            <Chip
              color={campaign.status === "started" ? "success" : "warning"}
              variant="flat"
              className="flex-shrink-0 capitalize"
            >
              {campaign.status === "started" ? "Live" : campaign.status}
            </Chip>
          </div>
          <Button
            color="danger"
            variant="flat"
            size="sm"
            onPress={() => setIsEndModalOpen(true)}
            startContent={<Icon icon="solar:stop-circle-bold" width={16} />}
          >
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

        {/* Tabs */}
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => {
            setActiveTab(key as "queued" | "accounts" | "published");
            setPostsPage(1);
          }}
          variant="underlined"
          classNames={{
            base: "w-full",
            tabList:
              "gap-6 px-0 py-0 w-full relative rounded-none border-b border-border-base",
            cursor: "w-full bg-accent-400",
            tab: "max-w-fit px-2 h-12",
            tabContent:
              "text-text-secondary group-data-[selected=true]:text-accent-400",
          }}
        >
          <Tab
            key="queued"
            title={
              <div className="flex items-center gap-2">
                <span>Queued Posts</span>
                {activeTab === "queued" && videoGroups.length > 0 && (
                  <Chip
                    size="sm"
                    variant="flat"
                    classNames={{
                      base: "bg-accent-400/10 text-accent-400 h-5 min-w-5",
                      content: "text-xs font-semibold px-1",
                    }}
                  >
                    {videoGroups.length}
                  </Chip>
                )}
              </div>
            }
          />
          <Tab key="accounts" title="Accounts" />
          <Tab key="published" title="Published Posts" />
        </Tabs>

        {/* Tab content */}
        <div className="mt-6">
          {activeTab === "accounts" && (
            <AccountsTab
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          )}

          {(activeTab === "queued" || activeTab === "published") && (
            <div className="space-y-4">
              {/* Add videos bar (queued tab only) */}
              {activeTab === "queued" && (
                <div className="flex items-center justify-end">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      className="bg-surface-elevated border border-border-base text-text-secondary h-9"
                      onPress={() => setIsPickerOpen(true)}
                      startContent={<Icon icon="solar:library-bold-duotone" width={14} />}
                    >
                      Add from Library
                    </Button>
                    <Button
                      size="sm"
                      color="primary"
                      className="h-9"
                      onPress={() => setIsUploadOpen(true)}
                      startContent={<Icon icon="solar:upload-bold-duotone" width={14} />}
                    >
                      Upload Videos
                    </Button>
                  </div>
                </div>
              )}

              {/* Posts table — grouped by unique video */}
              <div className="bg-surface-base border border-border-base rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-3 border-b border-border-base flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">
                    {postsTab === "queued" ? "Campaign Videos" : "Published Posts"}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {videoGroups.length} video{videoGroups.length !== 1 ? "s" : ""}{postsTab === "published" ? ` \u00B7 ${totalPosts} post${totalPosts !== 1 ? "s" : ""}` : ""}
                  </span>
                </div>

                {/* Table */}
                {postsLoading ? (
                  <div className="p-12 text-center text-text-secondary">Loading...</div>
                ) : videoGroups.length === 0 ? (
                  <div className="p-12 text-center text-text-secondary">
                    {postsTab === "queued"
                      ? "No videos in this campaign yet. Add videos to get started."
                      : "No published posts yet."}
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-surface-elevated border-b border-border-base">
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
                            {postsTab === "queued" ? "Created" : "Published"}
                            {sortBy === "created_at" && <Icon icon={sortOrder === "asc" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} width={12} />}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base">
                      {pagedGroups.map((group) => {
                        // For queued tab: publish_status from backend (waiting_assignment / in_drive / published)
                        // For published tab: aggregate from post-level statuses
                        const aggregateStatus = postsTab === "queued"
                          ? (group.statuses[0] || "waiting_assignment")
                          : group.statuses.includes("processing") ? "processing"
                            : group.statuses.every((s) => s === "posted") ? "posted"
                            : "scheduled";
                        const statusStyle = getPostStatusStyle(aggregateStatus);
                        return (
                          <tr key={group.clipId ?? group.posts[0]?.id} className="hover:bg-surface-elevated/50 transition-colors">
                            {/* Video thumbnail + title */}
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                {group.clipUrl ? (
                                  <button
                                    onClick={() => setPlayingVideo({ url: group.clipUrl!, title: group.clipTitle || "Video" })}
                                    className="relative group w-16 h-10 rounded overflow-hidden bg-black flex-shrink-0"
                                  >
                                    <video src={group.clipUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                      <Icon icon="solar:play-bold" className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </button>
                                ) : (
                                  <div className="w-16 h-10 rounded bg-surface-elevated flex-shrink-0" />
                                )}
                                <span className="text-sm text-text-primary truncate max-w-[200px]">
                                  {group.clipTitle || `Video #${group.clipId}`}
                                </span>
                              </div>
                            </td>
                            {/* Platforms — chip per platform with count */}
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
                            {/* Total posts count */}
                            <td className="px-6 py-3">
                              <span className="text-sm text-text-secondary">{group.posts.length || "\u2014"}</span>
                            </td>
                            {/* Aggregate status */}
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${statusStyle.className}`}>
                                {aggregateStatus === "processing" && (
                                  <Icon icon="solar:refresh-bold" className="w-3 h-3 animate-spin" />
                                )}
                                {statusStyle.label}
                              </span>
                            </td>
                            {/* Date */}
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

                {/* Pagination */}
                {totalVideoPages > 1 && (
                  <div className="px-6 py-3 border-t border-border-base flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Page {postsPage} of {totalVideoPages}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-surface-elevated border border-border-base text-text-secondary h-7 text-xs"
                        isDisabled={postsPage === 1}
                        onPress={() => setPostsPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-surface-elevated border border-border-base text-text-secondary h-7 text-xs"
                        isDisabled={postsPage === totalVideoPages}
                        onPress={() => setPostsPage((p) => Math.min(totalVideoPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Video player modal */}
              {playingVideo && (
                <Modal
                  isOpen
                  onClose={() => setPlayingVideo(null)}
                  size="2xl"
                  classNames={{ base: "bg-surface-base border border-border-base" }}
                >
                  <ModalContent>
                    <ModalHeader className="border-b border-border-base text-text-primary">
                      {playingVideo.title}
                    </ModalHeader>
                    <ModalBody className="p-0">
                      <video
                        src={playingVideo.url}
                        controls
                        autoPlay
                        className="w-full max-h-[70vh]"
                      />
                    </ModalBody>
                  </ModalContent>
                </Modal>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bulk upload modal */}
      <BulkUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
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
          onClose={() => setIsPickerOpen(false)}
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
      <Modal
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        classNames={{ base: "bg-surface-base border border-border-base" }}
      >
        <ModalContent>
          <ModalHeader className="border-b border-border-base">
            <div className="flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold-duotone" className="text-danger-500" width={20} />
              <span className="text-text-primary">End Campaign</span>
            </div>
          </ModalHeader>
          <ModalBody className="py-4">
            <p className="text-sm text-text-secondary">
              Are you sure you want to end this campaign? This action will stop all posting
              and mark the campaign as completed. This cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter className="border-t border-border-base">
            <Button
              variant="flat"
              className="bg-surface-elevated text-text-secondary"
              onPress={() => setIsEndModalOpen(false)}
              isDisabled={isEnding}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleEndCampaign}
              isLoading={isEnding}
            >
              End Campaign
            </Button>
          </ModalFooter>
        </ModalContent>
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
