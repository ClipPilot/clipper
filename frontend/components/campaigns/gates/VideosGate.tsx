"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Button,
  Card,
  CardBody,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Progress,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Tooltip,
  Chip,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { campaignAPI, type CampaignVideo, type CampaignGates } from "@/api/campaign";
import { clipsAPI, type Clip, type Folder } from "@/api/clips";

// ── Clip Picker Modal ────────────────────────────────────────────────────────

interface ClipPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  campaignId: number;
  existingClipIds: Set<number>;
  onAdded: () => void;
}

function ClipPickerModal({
  isOpen,
  onClose,
  teamId,
  campaignId,
  existingClipIds,
  onAdded,
}: ClipPickerModalProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const BATCH_SIZE = 40;

  // Load folders once
  useEffect(() => {
    if (!isOpen) return;
    clipsAPI.getFolders(teamId).then(setFolders).catch(() => {});
  }, [isOpen, teamId]);

  // Load clips (all saved or by folder)
  const loadClips = useCallback(
    async (folderId: number | null, reset: boolean) => {
      setIsLoading(true);
      try {
        if (folderId !== null) {
          const folderClips = await clipsAPI.getClipsByFolder(teamId, folderId);
          setClips(folderClips);
          setHasMore(false);
          setOffset(folderClips.length);
        } else {
          const newOffset = reset ? 0 : offset;
          const { clips: batch, hasMore: more } = await clipsAPI.getSavedClips(
            teamId,
            BATCH_SIZE,
            newOffset,
          );
          if (reset) {
            setClips(batch);
          } else {
            setClips((prev) => [...prev, ...batch]);
          }
          setHasMore(more);
          setOffset(newOffset + batch.length);
        }
      } catch {
        addToast({
          title: "Failed to load clips",
          description: "Could not load your clip library.",
          color: "danger",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [teamId, offset],
  );

  // Initial load when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setActiveFolderId(null);
      setOffset(0);
      return;
    }
    loadClips(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleFolderClick = (folderId: number | null) => {
    setActiveFolderId(folderId);
    setOffset(0);
    loadClips(folderId, true);
  };

  const toggleClip = (clipId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const available = clips.filter((c) => !existingClipIds.has(c.id));
    setSelectedIds(new Set(available.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setIsAdding(true);
    try {
      await campaignAPI.addVideos(teamId, campaignId, Array.from(selectedIds));
      addToast({
        title: "Clips added",
        description: `${selectedIds.size} clip${selectedIds.size !== 1 ? "s" : ""} added to campaign.`,
        color: "success",
      });
      onAdded();
      onClose();
    } catch (err: any) {
      addToast({
        title: "Failed to add clips",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const availableClips = clips.filter((c) => !existingClipIds.has(c.id));
  const allSelected = availableClips.length > 0 && availableClips.every((c) => selectedIds.has(c.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      classNames={{ base: "bg-surface-base border border-border-base" }}
    >
      <ModalContent>
        <ModalHeader className="border-b border-border-base">
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:library-bold-duotone"
              className="text-accent-400"
              width={22}
            />
            <span className="text-text-primary">Add from Library</span>
          </div>
        </ModalHeader>

        <ModalBody className="py-4 gap-4">
          {/* Folder tabs */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={activeFolderId === null ? "solid" : "flat"}
              color={activeFolderId === null ? "primary" : "default"}
              className={activeFolderId === null ? "" : "bg-surface-elevated text-text-secondary"}
              onPress={() => handleFolderClick(null)}
            >
              All Saved
            </Button>
            {folders.map((folder) => (
              <Button
                key={folder.id}
                size="sm"
                variant={activeFolderId === folder.id ? "solid" : "flat"}
                color={activeFolderId === folder.id ? "primary" : "default"}
                className={activeFolderId === folder.id ? "" : "bg-surface-elevated text-text-secondary"}
                onPress={() => handleFolderClick(folder.id)}
                startContent={
                  <Icon icon="solar:folder-bold-duotone" width={14} />
                }
              >
                {folder.name}
              </Button>
            ))}
          </div>

          {/* Select all / deselect */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary">
              {availableClips.length} clip{availableClips.length !== 1 ? "s" : ""} available
              {selectedIds.size > 0 && (
                <span className="text-accent-400 ml-1">
                  ({selectedIds.size} selected)
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="light"
                className="text-text-secondary h-7 text-xs"
                onPress={allSelected ? deselectAll : selectAll}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </div>

          {/* Clip grid */}
          {isLoading && clips.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" color="primary" />
            </div>
          ) : availableClips.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Icon
                icon="solar:video-library-bold-duotone"
                className="text-text-tertiary"
                width={32}
              />
              <p className="text-sm text-text-secondary">
                {clips.length > 0
                  ? "All clips from this view are already in the campaign."
                  : "No saved clips found."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {availableClips.map((clip) => {
                  const isSelected = selectedIds.has(clip.id);
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      onClick={() => toggleClip(clip.id)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                        isSelected
                          ? "border-accent-400 ring-1 ring-accent-400/30"
                          : "border-border-base hover:border-text-tertiary"
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-[9/16] bg-surface-elevated flex items-center justify-center">
                        {clip.clipUrl ? (
                          <video
                            src={clip.clipUrl}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <Icon
                            icon="solar:video-library-bold-duotone"
                            className="text-text-tertiary"
                            width={24}
                          />
                        )}
                      </div>

                      {/* Overlay info */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-[11px] text-white truncate">
                          {clip.title || `Clip #${clip.id}`}
                        </p>
                      </div>

                      {/* Selection checkbox */}
                      <div className="absolute top-2 left-2">
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-accent-400 border-accent-400"
                              : "bg-black/40 border-white/50"
                          }`}
                        >
                          {isSelected && (
                            <Icon icon="solar:check-read-bold" width={12} className="text-white" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Load more */}
              {hasMore && activeFolderId === null && (
                <div className="flex justify-center pt-2">
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-surface-elevated text-text-secondary"
                    onPress={() => loadClips(null, false)}
                    isLoading={isLoading}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </ModalBody>

        <ModalFooter className="border-t border-border-base">
          <Button
            variant="flat"
            className="bg-surface-elevated text-text-secondary"
            onPress={onClose}
            isDisabled={isAdding}
          >
            Cancel
          </Button>
          <Button
            className="bg-accent-400 text-white font-medium"
            onPress={handleAdd}
            isLoading={isAdding}
            isDisabled={selectedIds.size === 0}
            startContent={
              !isAdding && <Icon icon="solar:add-circle-bold" width={18} />
            }
          >
            Add {selectedIds.size > 0 ? `${selectedIds.size} Clip${selectedIds.size !== 1 ? "s" : ""}` : "Selected"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ── Upload Progress Item ─────────────────────────────────────────────────────

interface UploadingFile {
  name: string;
  progress: number;
  status: "uploading" | "completing" | "done" | "error";
}

// ── Video Preview Modal ─────────────────────────────────────────────────────

interface VideoPreviewModalProps {
  video: CampaignVideo | null;
  isOpen: boolean;
  onClose: () => void;
}

function VideoPreviewModal({ video, isOpen, onClose }: VideoPreviewModalProps) {
  if (!video) return null;
  const src = video.presigned_url;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      classNames={{ base: "bg-surface-base border border-border-base" }}
    >
      <ModalContent>
        <ModalHeader className="border-b border-border-base">
          <div className="flex items-center gap-2 min-w-0">
            <Icon
              icon="solar:video-frame-play-vertical-bold-duotone"
              className="text-accent-400 flex-shrink-0"
              width={20}
            />
            <span className="text-text-primary truncate">
              {video.title ?? video.file_name ?? `Video #${video.id}`}
            </span>
          </div>
        </ModalHeader>
        <ModalBody className="py-4 flex items-center justify-center">
          {src ? (
            <video
              src={src}
              controls
              autoPlay
              className="w-full max-h-[70vh] rounded-lg bg-black"
              playsInline
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Icon
                icon="solar:video-library-bold-duotone"
                className="text-text-tertiary"
                width={40}
              />
              <p className="text-sm text-text-secondary">
                Video not available for preview
              </p>
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// ── Video Table ─────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 10;

const VIDEO_COLUMNS = [
  { uid: "thumbnail", name: "" },
  { uid: "title", name: "Title" },
  { uid: "source", name: "Source" },
  { uid: "added", name: "Added" },
  { uid: "actions", name: "" },
] as const;

interface VideoTableProps {
  videos: CampaignVideo[];
  page: number;
  onPageChange: (page: number) => void;
  onPreview: (video: CampaignVideo) => void;
  onRemove: (videoId: number) => void;
  removingId: number | null;
}

function VideoTable({
  videos,
  page,
  onPageChange,
  onPreview,
  onRemove,
  removingId,
}: VideoTableProps) {
  const totalPages = Math.ceil(videos.length / ROWS_PER_PAGE) || 1;

  const pageItems = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return videos.slice(start, start + ROWS_PER_PAGE);
  }, [videos, page]);

  // Reset to page 1 if current page exceeds total after removal
  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
  }, [page, totalPages, onPageChange]);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateString));
  };

  const renderCell = useCallback(
    (video: CampaignVideo, columnKey: string) => {
      switch (columnKey) {
        case "thumbnail":
          return (
            <div className="w-10 h-10 rounded-lg bg-default-100 flex items-center justify-center flex-shrink-0 overflow-hidden relative cursor-pointer">
              {video.presigned_url ? (
                <>
                  <video
                    src={video.presigned_url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Icon
                      icon="solar:play-bold"
                      className="text-white"
                      width={12}
                    />
                  </div>
                </>
              ) : (
                <Icon
                  icon="solar:video-library-bold-duotone"
                  className="text-text-tertiary"
                  width={16}
                />
              )}
            </div>
          );
        case "title":
          return (
            <p className="text-sm text-text-primary truncate max-w-[200px]">
              {video.title ?? video.file_name ?? `Video #${video.id}`}
            </p>
          );
        case "source":
          return video.clip_id ? (
            <Chip
              size="sm"
              variant="flat"
              className="bg-accent-400/10 text-accent-400"
              startContent={
                <Icon icon="solar:library-bold-duotone" width={12} className="ml-1" />
              }
            >
              Library
            </Chip>
          ) : (
            <Chip
              size="sm"
              variant="flat"
              className="bg-warning-500/10 text-warning-600"
              startContent={
                <Icon icon="solar:upload-bold-duotone" width={12} className="ml-1" />
              }
            >
              Upload
            </Chip>
          );
        case "added":
          return (
            <span className="text-xs text-text-secondary whitespace-nowrap">
              {formatDate(video.created_at)}
            </span>
          );
        case "actions":
          return (
            <div className="flex items-center justify-end gap-1">
              <Tooltip content="Preview">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => onPreview(video)}
                  aria-label="Preview video"
                >
                  <Icon
                    icon="solar:eye-bold"
                    className="text-text-secondary"
                    width={16}
                  />
                </Button>
              </Tooltip>
              <Tooltip content="Remove">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  className="text-danger-500"
                  onPress={() => onRemove(video.id)}
                  isLoading={removingId === video.id}
                  aria-label="Remove video"
                >
                  <Icon icon="solar:trash-bin-trash-bold" width={16} />
                </Button>
              </Tooltip>
            </div>
          );
        default:
          return null;
      }
    },
    [onPreview, onRemove, removingId],
  );

  const bottomContent = useMemo(() => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-small text-text-tertiary">
          {videos.length} video{videos.length !== 1 ? "s" : ""} total
        </span>
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={page}
          total={totalPages}
          onChange={onPageChange}
        />
      </div>
    );
  }, [page, totalPages, videos.length, onPageChange]);

  return (
    <Table
      aria-label="Campaign videos"
      bottomContent={bottomContent}
      bottomContentPlacement="outside"
      classNames={{
        wrapper: "bg-surface-base border border-border-base shadow-none",
        th: "bg-surface-elevated text-text-secondary text-xs uppercase",
        td: "py-2",
        tr: "hover:bg-surface-elevated/50 cursor-pointer transition-colors",
      }}
      onRowAction={(key) => {
        const video = videos.find((v) => v.id === Number(key));
        if (video) onPreview(video);
      }}
    >
      <TableHeader columns={[...VIDEO_COLUMNS]}>
        {(column) => (
          <TableColumn
            key={column.uid}
            align={column.uid === "actions" ? "end" : "start"}
            width={
              column.uid === "thumbnail"
                ? 56
                : column.uid === "actions"
                  ? 100
                  : undefined
            }
          >
            {column.name}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody items={pageItems} emptyContent="No videos added yet">
        {(video) => (
          <TableRow key={video.id}>
            {(columnKey) => (
              <TableCell>{renderCell(video, columnKey as string)}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

// ── Main VideosGate ──────────────────────────────────────────────────────────

interface VideosGateProps {
  campaignId: number;
  videos: CampaignVideo[];
  gate: CampaignGates["videos"];
  onRefresh: () => void;
}

export function VideosGate({
  campaignId,
  videos,
  gate,
  onRefresh,
}: VideosGateProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [previewVideo, setPreviewVideo] = useState<CampaignVideo | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<
    Map<string, UploadingFile>
  >(new Map());

  const progressValue =
    gate.videoMinimum > 0
      ? Math.min(100, Math.round((gate.videoCount / gate.videoMinimum) * 100))
      : 100;

  // Set of clip IDs already in the campaign (to filter them out in picker)
  const existingClipIds = new Set(
    videos.filter((v) => v.clip_id != null).map((v) => v.clip_id as number),
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedTeam?.id) return;
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      // Reset input so same files can be re-selected
      e.target.value = "";

      for (const file of files) {
        const key = `${file.name}-${Date.now()}`;

        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.set(key, { name: file.name, progress: 0, status: "uploading" });
          return next;
        });

        try {
          // Step 1: get presigned URL
          const { video, uploadUrl } = await campaignAPI.uploadVideo(
            selectedTeam.id,
            campaignId,
            file.name,
            file.type || "video/mp4",
          );

          // Step 2: PUT to presigned URL with progress tracking
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", uploadUrl);
            xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const pct = Math.round((event.loaded / event.total) * 100);
                setUploadingFiles((prev) => {
                  const next = new Map(prev);
                  next.set(key, {
                    name: file.name,
                    progress: pct,
                    status: "uploading",
                  });
                  return next;
                });
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                reject(new Error(`Upload failed: ${xhr.status}`));
              }
            };

            xhr.onerror = () => reject(new Error("Network error during upload"));
            xhr.send(file);
          });

          // Step 3: notify backend
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            next.set(key, { name: file.name, progress: 100, status: "completing" });
            return next;
          });

          await campaignAPI.completeUpload(selectedTeam.id, campaignId, video.id);

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

          onRefresh();
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
      }
    },
    [selectedTeam?.id, campaignId, onRefresh],
  );

  const handleRemoveVideo = async (videoId: number) => {
    if (!selectedTeam?.id) return;
    setRemovingId(videoId);
    try {
      await campaignAPI.removeVideo(selectedTeam.id, campaignId, videoId);
      addToast({ title: "Video removed", color: "success" });
      onRefresh();
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

  const uploadingEntries = Array.from(uploadingFiles.entries());

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Videos added</span>
          <span className="font-semibold text-text-primary">
            {gate.videoCount} / {gate.videoMinimum}
          </span>
        </div>
        <Progress
          value={progressValue}
          color={gate.complete ? "success" : "primary"}
          size="sm"
          classNames={{ base: "w-full" }}
        />
        {gate.complete && (
          <p className="text-xs text-success-500 flex items-center gap-1">
            <Icon icon="solar:check-circle-bold" width={14} />
            Minimum video requirement met
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="flat"
          className="bg-surface-elevated text-text-secondary"
          onPress={() => setIsPickerOpen(true)}
          startContent={
            <Icon icon="solar:library-bold-duotone" width={16} />
          }
        >
          Add from Library
        </Button>

        <Button
          size="sm"
          color="primary"
          onPress={() => fileInputRef.current?.click()}
          startContent={<Icon icon="solar:upload-bold-duotone" width={16} />}
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

      {/* Uploading progress rows */}
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

      {/* Video table (paginated) */}
      {videos.length > 0 && (
        <VideoTable
          videos={videos}
          page={tablePage}
          onPageChange={setTablePage}
          onPreview={setPreviewVideo}
          onRemove={handleRemoveVideo}
          removingId={removingId}
        />
      )}

      {videos.length === 0 && uploadingEntries.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Icon
            icon="solar:video-library-bold-duotone"
            className="text-text-tertiary"
            width={32}
          />
          <p className="text-sm text-text-secondary">No videos added yet</p>
          <p className="text-xs text-text-tertiary">
            Add clips from your library or upload video files above.
          </p>
        </div>
      )}

      {/* Clip picker modal */}
      {selectedTeam?.id && (
        <ClipPickerModal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          teamId={selectedTeam.id}
          campaignId={campaignId}
          existingClipIds={existingClipIds}
          onAdded={onRefresh}
        />
      )}

      {/* Video preview modal */}
      <VideoPreviewModal
        video={previewVideo}
        isOpen={previewVideo !== null}
        onClose={() => setPreviewVideo(null)}
      />
    </div>
  );
}
