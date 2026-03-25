"use client";

import { useState } from "react";
import {
  Button,
  ProgressBar,
  toast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { campaignAPI, type CampaignVideo, type CampaignGates } from "@/api/campaign";
import { useBulkVideoUpload } from "@/hooks/useBulkVideoUpload";
import { BulkUploadModal } from "../shared/BulkUploadModal";
import { ClipPickerModal } from "../shared/ClipPickerModal";
import { VideoPreviewModal } from "../shared/VideoPreviewModal";
import { VideoTable } from "../shared/VideoTable";

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

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [previewVideo, setPreviewVideo] = useState<CampaignVideo | null>(null);

  const bulk = useBulkVideoUpload(selectedTeam?.id, campaignId, onVideoAdded);

  const progressValue =
    gate.videoMinimum > 0
      ? Math.min(100, Math.round((gate.videoCount / gate.videoMinimum) * 100))
      : 100;

  const existingClipIds = new Set(
    videos.filter((v) => v.clip_id != null).map((v) => v.clip_id as number),
  );

  const handleRemoveVideo = async (videoId: number) => {
    if (!selectedTeam?.id) return;
    setRemovingId(videoId);
    try {
      await campaignAPI.removeVideo(selectedTeam.id, campaignId, videoId);
      onVideoRemoved(videoId);
      toast.success("Video removed");
    } catch (err: any) {
      toast.danger("Failed to remove video", { description: err.message || "Something went wrong" });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Videos added</span>
          <span className="font-semibold text-text-accent">
            {gate.videoCount} / {gate.videoMinimum}
          </span>
        </div>
        <ProgressBar
 value={progressValue}
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
        {gate.complete && (
          <p className="text-xs text-success-500 flex items-center gap-1">
            <Icon icon="solar:check-circle-bold" width={14} />
            Minimum video requirement met
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
 size="sm"
 variant="tertiary"
 className="bg-surface-elevated text-text-secondary"
 onPress={() => setIsPickerOpen(true)}
 >
          <Icon icon="solar:library-bold-duotone" width={16} />
          Add from Library
        </Button>
        <Button variant="primary"
 size="sm"
 onPress={() => setIsUploadOpen(true)}
 >
          <Icon icon="solar:upload-bold-duotone" width={16} />
          Upload Videos
        </Button>
      </div>

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

      {videos.length === 0 && !bulk.isActive && (
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

      <VideoPreviewModal
        video={previewVideo}
        isOpen={previewVideo !== null}
        onClose={() => setPreviewVideo(null)}
      />
    </div>
  );
}
