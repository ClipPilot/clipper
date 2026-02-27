"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMemo } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Pagination,
  Progress,
  Spinner,
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
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
import { adPostingAPI, type GetTeamPostsParams } from "@/api/adPosting";
import type { TeamPost, PostsPagination } from "@/types/massPosting";
import { CampaignInfoBar } from "./CampaignInfoBar";
import { VideoPreviewModal } from "../shared/VideoPreviewModal";
import { ClipPickerModal } from "../shared/ClipPickerModal";
import { SetupModal } from "../gates/PaymentGate";
import { AccountsTab } from "@/components/mass-posting/dashboard/AccountsTab";
import { PublishedPostsTab } from "@/components/mass-posting/dashboard/PublishedPostsTab";

// ── Upload type ──────────────────────────────────────────────────────────────

interface UploadingFile {
  name: string;
  progress: number;
  status: "uploading" | "completing" | "done" | "error";
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ActiveCampaignDashboardProps {
  campaign: Campaign;
  videos: CampaignVideo[];
  wallet: CampaignWallet | null;
  savedCard: CampaignCard | null;
  onBack: () => void;
  onVideoAdded: (video: CampaignVideo) => void;
  onVideosAdded: (videos: CampaignVideo[]) => void;
  onVideoRemoved: (videoId: number) => void;
  onCampaignUpdated: (campaign: Campaign) => void;
}

type TabKey = "queued" | "accounts" | "published";

export function ActiveCampaignDashboard({
  campaign,
  videos,
  wallet,
  savedCard,
  onBack,
  onVideoAdded,
  onVideosAdded,
  onVideoRemoved,
  onCampaignUpdated,
}: ActiveCampaignDashboardProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("queued");
  const [dateRange, setDateRange] = useState("mtd");

  // Published posts state
  const [publishedPosts, setPublishedPosts] = useState<TeamPost[]>([]);
  const [publishedPagination, setPublishedPagination] = useState<PostsPagination | null>(null);
  const [publishedLoading, setPublishedLoading] = useState(false);

  // Video table state
  const [tablePage, setTablePage] = useState(1);
  const [previewVideo, setPreviewVideo] = useState<CampaignVideo | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(new Map());

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

  // Fetch published posts scoped to this campaign
  const fetchPublishedPosts = useCallback(
    async (params: GetTeamPostsParams = {}) => {
      if (!selectedTeam?.id) return;
      setPublishedLoading(true);
      try {
        const result = await adPostingAPI.getTeamPosts(selectedTeam.id, {
          tab: "published",
          pageSize: 20,
          dateRange,
          campaignId: campaign.id,
          ...params,
        });
        setPublishedPosts(result.posts);
        setPublishedPagination(result.pagination);
      } catch (err) {
        console.error("Failed to fetch published posts:", err);
      } finally {
        setPublishedLoading(false);
      }
    },
    [selectedTeam?.id, dateRange, campaign.id],
  );

  useEffect(() => {
    fetchPublishedPosts({ dateRange });
  }, [fetchPublishedPosts, dateRange]);

  // Existing clip IDs for the picker filter
  const existingClipIds = new Set(
    videos.filter((v) => v.clip_id != null).map((v) => v.clip_id as number),
  );

  // Upload logic (same pattern as VideosGate)
  const uploadSingleFile = useCallback(
    async (file: File, key: string) => {
      if (!selectedTeam?.id) return;

      try {
        const { video, uploadUrl } = await campaignAPI.uploadVideo(
          selectedTeam.id,
          campaign.id,
          file.name,
          file.type || "video/mp4",
        );

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const pct = Math.round((event.loaded / event.total) * 100);
              setUploadingFiles((prev) => {
                const next = new Map(prev);
                next.set(key, { name: file.name, progress: pct, status: "uploading" });
                return next;
              });
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(file);
        });

        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.set(key, { name: file.name, progress: 100, status: "completing" });
          return next;
        });

        const { video: completedVideo } = await campaignAPI.completeUpload(
          selectedTeam.id,
          campaign.id,
          video.id,
        );

        onVideoAdded(completedVideo);

        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.set(key, { name: file.name, progress: 100, status: "done" });
          return next;
        });

        setTimeout(() => {
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        }, 1500);
      } catch (err: any) {
        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.set(key, { name: file.name, progress: 0, status: "error" });
          return next;
        });
        addToast({
          title: "Upload failed",
          description: `${file.name}: ${err.message || "Something went wrong"}`,
          color: "danger",
        });
      }
    },
    [selectedTeam?.id, campaign.id, onVideoAdded],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedTeam?.id) return;
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      e.target.value = "";

      const entries: [string, File][] = files.map((file, i) => [
        `${file.name}-${Date.now()}-${i}`,
        file,
      ]);

      setUploadingFiles((prev) => {
        const next = new Map(prev);
        for (const [key, file] of entries) {
          next.set(key, { name: file.name, progress: 0, status: "uploading" });
        }
        return next;
      });

      await Promise.allSettled(
        entries.map(([key, file]) => uploadSingleFile(file, key)),
      );
    },
    [selectedTeam?.id, uploadSingleFile],
  );

  const handleRemoveVideo = async (videoId: number) => {
    if (!selectedTeam?.id) return;
    setRemovingId(videoId);
    try {
      await campaignAPI.removeVideo(selectedTeam.id, campaign.id, videoId);
      onVideoRemoved(videoId);
      addToast({ title: "Video removed", color: "success" });
    } catch (err: any) {
      addToast({
        title: "Failed to remove video",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    } finally {
      setRemovingId(null);
    }
  };

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
      const { contract } = await campaignAPI.getContract(
        selectedTeam.id,
        campaign.id,
      );
      if (contract?.presigned_pdf_url) {
        window.open(contract.presigned_pdf_url, "_blank", "noopener,noreferrer");
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

  const uploadingEntries = Array.from(uploadingFiles.entries());

  const ROWS_PER_PAGE = 10;
  const totalPages = Math.ceil(videos.length / ROWS_PER_PAGE) || 1;
  const pageItems = useMemo(() => {
    const start = (tablePage - 1) * ROWS_PER_PAGE;
    return videos.slice(start, start + ROWS_PER_PAGE);
  }, [videos, tablePage]);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return {
      date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d),
      time: new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(d),
    };
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
          onSelectionChange={(key) => setActiveTab(key as TabKey)}
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
                {videos.length > 0 && (
                  <Chip
                    size="sm"
                    variant="flat"
                    classNames={{
                      base: "bg-accent-400/10 text-accent-400 h-5 min-w-5",
                      content: "text-xs font-semibold px-1",
                    }}
                  >
                    {videos.length}
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
          {activeTab === "queued" && (
            <div className="space-y-4">
              {/* Upload progress rows */}
              {uploadingEntries.length > 0 && (
                <div className="space-y-2">
                  {uploadingEntries.map(([key, item]) => (
                    <Card
                      key={key}
                      className="bg-surface-elevated border border-border-base"
                    >
                      <CardBody className="p-3 gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon
                              icon={
                                item.status === "error"
                                  ? "solar:close-circle-bold"
                                  : item.status === "done"
                                    ? "solar:check-circle-bold"
                                    : "solar:upload-bold-duotone"
                              }
                              className={
                                item.status === "error"
                                  ? "text-danger-500 flex-shrink-0"
                                  : item.status === "done"
                                    ? "text-success-500 flex-shrink-0"
                                    : "text-accent-400 flex-shrink-0"
                              }
                              width={16}
                            />
                            <span className="text-xs text-text-primary truncate">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-xs text-text-secondary flex-shrink-0">
                            {item.status === "completing"
                              ? "Processing..."
                              : item.status === "done"
                                ? "Done"
                                : item.status === "error"
                                  ? "Error"
                                  : `${item.progress}%`}
                          </span>
                        </div>
                        {item.status === "uploading" && (
                          <Progress
                            value={item.progress}
                            size="sm"
                            color="primary"
                            classNames={{ base: "w-full" }}
                          />
                        )}
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}

              {/* Video table (Published Posts style) */}
              <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
                {/* Header bar with actions */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-base">
                  <p className="text-sm text-text-secondary">
                    {videos.length} video{videos.length !== 1 ? "s" : ""} queued
                  </p>
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
                      onPress={() => fileInputRef.current?.click()}
                      startContent={<Icon icon="solar:upload-bold-duotone" width={14} />}
                    >
                      Upload Videos
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>

                {videos.length === 0 && uploadingEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                    <Icon
                      icon="solar:video-library-bold-duotone"
                      width={48}
                      className="mb-3 opacity-40"
                    />
                    <p className="text-sm">No videos added yet</p>
                    <p className="text-xs text-text-tertiary mt-1">
                      Add clips from your library or upload video files above.
                    </p>
                  </div>
                ) : videos.length > 0 ? (
                  <Table
                    aria-label="Queued campaign videos"
                    removeWrapper
                    classNames={{
                      th: "bg-surface-elevated text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4",
                      td: "py-4 px-4 border-t border-border-base",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>CONTENT</TableColumn>
                      <TableColumn>SOURCE</TableColumn>
                      <TableColumn>ADDED</TableColumn>
                      <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {pageItems.map((video) => {
                        const { date, time } = formatDate(video.created_at);
                        return (
                          <TableRow
                            key={video.id}
                            className="hover:bg-surface-elevated/50 transition-colors"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {video.presigned_url ? (
                                  <button
                                    onClick={() => setPreviewVideo(video)}
                                    className="relative w-[72px] h-[48px] rounded-md overflow-hidden bg-surface-elevated flex-shrink-0 group cursor-pointer"
                                  >
                                    <video
                                      src={video.presigned_url}
                                      className="w-full h-full object-cover"
                                      muted
                                      preload="metadata"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Icon icon="solar:play-bold" width={20} className="text-white" />
                                    </div>
                                  </button>
                                ) : (
                                  <div className="w-[72px] h-[48px] rounded-md bg-surface-elevated flex-shrink-0 flex items-center justify-center">
                                    <Icon icon="solar:videocamera-record-bold-duotone" width={24} className="text-text-tertiary" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-text-primary truncate max-w-[320px]">
                                    {video.title ?? video.file_name ?? `Video #${video.id}`}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
                                    <span className="text-xs text-text-tertiary">Queued</span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {video.clip_id ? (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  className="bg-accent-400/10 text-accent-400"
                                  startContent={<Icon icon="solar:library-bold-duotone" width={12} className="ml-1" />}
                                >
                                  Library
                                </Chip>
                              ) : (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  className="bg-warning-500/10 text-warning-600"
                                  startContent={<Icon icon="solar:upload-bold-duotone" width={12} className="ml-1" />}
                                >
                                  Upload
                                </Chip>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm text-text-primary">{date}</p>
                                <p className="text-xs text-text-tertiary">{time}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Tooltip content="Preview">
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    className="bg-transparent hover:bg-surface-elevated"
                                    onPress={() => setPreviewVideo(video)}
                                    aria-label="Preview video"
                                  >
                                    <Icon icon="solar:eye-bold" className="text-text-secondary" width={16} />
                                  </Button>
                                </Tooltip>
                                <Tooltip content="Remove">
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    className="bg-transparent hover:bg-danger-500/10 text-danger-500"
                                    onPress={() => handleRemoveVideo(video.id)}
                                    isLoading={removingId === video.id}
                                    aria-label="Remove video"
                                  >
                                    <Icon icon="solar:trash-bin-trash-bold" width={16} />
                                  </Button>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : null}

                {/* Pagination footer */}
                <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
                  <p className="text-sm text-text-tertiary">
                    {videos.length > 0 ? (
                      <>
                        Showing{" "}
                        <span className="font-medium text-text-secondary">
                          {Math.min((tablePage - 1) * ROWS_PER_PAGE + 1, videos.length)}-{Math.min(tablePage * ROWS_PER_PAGE, videos.length)}
                        </span>{" "}
                        of{" "}
                        <span className="font-medium text-text-secondary">{videos.length}</span>{" "}
                        videos
                      </>
                    ) : (
                      "No videos"
                    )}
                  </p>
                  {totalPages > 1 && (
                    <Pagination
                      total={totalPages}
                      page={tablePage}
                      onChange={setTablePage}
                      size="sm"
                      classNames={{
                        item: "bg-surface-elevated text-text-secondary",
                        cursor: "bg-accent-400 text-white",
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "accounts" && (
            <AccountsTab
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          )}

          {activeTab === "published" && (
            <PublishedPostsTab
              posts={publishedPosts}
              pagination={publishedPagination}
              isLoading={publishedLoading}
              onParamsChange={(params) => fetchPublishedPosts(params)}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          )}
        </div>
      </div>

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
