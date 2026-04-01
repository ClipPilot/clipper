"use client";

import { useState } from "react";
import { Button, toast } from "@heroui/react";
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
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Videos added</span>
          <span className="font-semibold text-text-primary">{gate.videoCount} / {gate.videoMinimum}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${gate.complete ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${progressValue}%` }}
          />
        </div>
        {gate.complete && (
          <p className="text-xs text-green-500 flex items-center gap-1">
            <Icon icon="solar:check-circle-bold" width={14} />
            Minimum video requirement met
          </p>
        )}
      </div>

      {videos.length === 0 && !bulk.isActive ? (
        <div className="rounded-xl bg-white/[0.03] py-12 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent-400/10 flex items-center justify-center">
            <Icon icon="solar:video-library-bold-duotone" className="text-accent-400" width={28} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">No videos added yet</p>
            <p className="text-xs text-text-tertiary mt-1">Add clips from your library or upload new video files</p>
          </div>
          <div className="flex gap-3">
            <Button size="sm" variant="tertiary" className="border border-border-base text-text-primary hover:border-accent-400/50" onPress={() => setIsPickerOpen(true)}>
              <Icon icon="solar:library-bold-duotone" width={16} />
              Add from Library
            </Button>
            <Button variant="primary" size="sm" className="bg-blue-500 text-white hover:bg-blue-600" onPress={() => setIsUploadOpen(true)}>
              <Icon icon="solar:upload-bold-duotone" width={16} />
              Upload Videos
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-white/[0.06] border border-border-base text-text-primary hover:bg-white/[0.1]" onPress={() => setIsPickerOpen(true)}>
              <Icon icon="solar:library-bold-duotone" width={16} />
              Add from Library
            </Button>
            <Button size="sm" className="bg-blue-500 text-white hover:bg-blue-600" onPress={() => setIsUploadOpen(true)}>
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
        </>
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
