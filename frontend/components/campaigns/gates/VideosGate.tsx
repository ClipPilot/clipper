"use client";

import { useState, useRef, useCallback } from "react";
import {
  Button,
  Card,
  CardBody,
  Progress,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { campaignAPI, type CampaignVideo, type CampaignGates } from "@/api/campaign";
import { ClipPickerModal } from "../shared/ClipPickerModal";
import { VideoPreviewModal } from "../shared/VideoPreviewModal";
import { VideoTable } from "../shared/VideoTable";

// ── Upload Progress Item ─────────────────────────────────────────────────────

export interface UploadingFile {
  name: string;
  progress: number;
  status: "uploading" | "completing" | "done" | "error";
}

// ── Main VideosGate ──────────────────────────────────────────────────────────

interface VideosGateProps {
  campaignId: number;
  videos: CampaignVideo[];
  gate: CampaignGates["videos"];
  onVideoAdded: (video: CampaignVideo) => void;
  onVideosAdded: (videos: CampaignVideo[]) => void;
  onVideoRemoved: (videoId: number) => void;
}

export function VideosGate({
  campaignId,
  videos,
  gate,
  onVideoAdded,
  onVideosAdded,
  onVideoRemoved,
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

  const uploadSingleFile = useCallback(
    async (file: File, key: string) => {
      if (!selectedTeam?.id) return;

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

        const { video: completedVideo } = await campaignAPI.completeUpload(
          selectedTeam.id,
          campaignId,
          video.id,
        );

        // Add to table dynamically — no full page refresh
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
    [selectedTeam?.id, campaignId, onVideoAdded],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedTeam?.id) return;
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      // Reset input so same files can be re-selected
      e.target.value = "";

      // Show ALL files as uploading immediately
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

      // Upload all in parallel — each pops into the table as it completes
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
      await campaignAPI.removeVideo(selectedTeam.id, campaignId, videoId);
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
          onAdded={onVideosAdded}
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
