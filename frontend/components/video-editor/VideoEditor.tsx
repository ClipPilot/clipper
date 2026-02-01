"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import {
  Button,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { clipsAPI, CaptionEntry } from "@/api/clips";
import {
  editorClipAtom,
  editorLoadingAtom,
  editorAccessDeniedAtom,
  videoDurationAtom,
  currentTimeAtom,
  isPlayingAtom,
  activeToolAtom,
  trimStateAtom,
  captionsEnabledAtom,
  captionsDataAtom,
  captionColorAtom,
  captionFontAtom,
  headingStateAtom,
  isSavingAtom,
  showSuccessModalAtom,
  editConfigAtom,
  thumbnailsAtom,
  isGeneratingThumbnailsAtom,
  EditorTool,
} from "@/store/videoEditor";
import { EditorToolPanel } from "./EditorToolPanel";
import { EditorTimeline } from "./EditorTimeline";
import { EditorVideoPreview } from "./EditorVideoPreview";

export function VideoEditor() {
  const params = useParams();
  const router = useRouter();
  const clipId = parseInt(params.clipId as string);
  const [selectedTeam] = useAtom(selectedTeamAtom);

  // Core state
  const [clip, setClip] = useAtom(editorClipAtom);
  const [loading, setLoading] = useAtom(editorLoadingAtom);
  const [accessDenied, setAccessDenied] = useAtom(editorAccessDeniedAtom);
  const [saving, setSaving] = useAtom(isSavingAtom);
  const [showSuccessModal, setShowSuccessModal] = useAtom(showSuccessModalAtom);

  // Video state
  const setVideoDuration = useSetAtom(videoDurationAtom);
  const [currentTime, setCurrentTime] = useAtom(currentTimeAtom);
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom);

  // Trim state
  const setTrimState = useSetAtom(trimStateAtom);

  // Captions state
  const setCaptionsEnabled = useSetAtom(captionsEnabledAtom);
  const setCaptionsData = useSetAtom(captionsDataAtom);
  const setCaptionColor = useSetAtom(captionColorAtom);
  const setCaptionFont = useSetAtom(captionFontAtom);

  // Heading state
  const setHeadingState = useSetAtom(headingStateAtom);

  // Thumbnails
  const setThumbnails = useSetAtom(thumbnailsAtom);
  const setIsGeneratingThumbnails = useSetAtom(isGeneratingThumbnailsAtom);

  // Edit config
  const editConfig = useAtomValue(editConfigAtom);

  // Active tool
  const [activeTool, setActiveTool] = useAtom(activeToolAtom);

  // Video ref
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load clip on mount
  useEffect(() => {
    if (selectedTeam?.id && clipId) {
      loadClip();
    }
  }, [selectedTeam?.id, clipId]);

  const loadClip = async () => {
    if (!selectedTeam?.id) return;
    setLoading(true);
    try {
      const data = await clipsAPI.getClip(selectedTeam.id, clipId);

      if (!data.saved || data.team_id !== selectedTeam.id) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setClip(data);

      // Initialize captions state
      if (data.captions_data) {
        setCaptionsData(JSON.parse(JSON.stringify(data.captions_data)));
      }

      // Initialize caption settings from metadata
      const metadata = data.clip_metadata as any;
      if (metadata?.parameters?.captionColor) {
        setCaptionColor(metadata.parameters.captionColor);
      }
      if (metadata?.parameters?.captionFont) {
        setCaptionFont(metadata.parameters.captionFont);
      }
      if (metadata?.parameters?.captionsEnabled !== undefined) {
        setCaptionsEnabled(metadata.parameters.captionsEnabled);
      } else {
        setCaptionsEnabled(metadata?.parameters?.captions !== false);
      }

      // Initialize heading state from metadata if exists
      if (metadata?.editorConfig?.heading) {
        setHeadingState(metadata.editorConfig.heading);
      }
    } catch (error) {
      console.error("Failed to load clip:", error);
      setAccessDenied(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle video metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setVideoDuration(duration);
      setTrimState({ startTime: 0, endTime: duration });
      generateThumbnails(duration);
    }
  }, [setVideoDuration, setTrimState]);

  // Generate thumbnails for timeline
  const generateThumbnails = useCallback(
    async (duration: number) => {
      if (!videoRef.current || !clip) return;

      setIsGeneratingThumbnails(true);
      const thumbnailCount = 10;
      const interval = duration / thumbnailCount;
      const newThumbnails: string[] = [];

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 160;
      canvas.height = 90;

      const video = document.createElement("video");
      video.src = clip.blankVideoUrl || clip.clipUrl || "";
      video.crossOrigin = "anonymous";
      video.muted = true;

      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
        video.load();
      });

      for (let i = 0; i < thumbnailCount; i++) {
        const time = i * interval;
        video.currentTime = time;
        await new Promise<void>((resolve) => {
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            newThumbnails.push(canvas.toDataURL("image/jpeg", 0.5));
            resolve();
          };
        });
      }

      setThumbnails(newThumbnails);
      setIsGeneratingThumbnails(false);
    },
    [clip, setThumbnails, setIsGeneratingThumbnails]
  );

  // Handle time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, [setCurrentTime]);

  // Seek to time
  const seekToTime = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, [setCurrentTime]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, setIsPlaying]);

  // Handle apply changes
  const handleApplyChanges = async () => {
    if (!selectedTeam?.id || !clip) return;
    setSaving(true);

    try {
      // Submit video edit job with all editing operations
      await clipsAPI.submitVideoEdit(selectedTeam.id, clip.id, editConfig);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Failed to apply changes:", error);
      addToast({
        title: "Failed to apply",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle success modal close
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    router.push("/dashboard/clips?tab=processing");
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  // Access denied state
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <Icon icon="solar:lock-keyhole-bold-duotone" className="text-red-500" width={32} />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Access Denied</h2>
        <p className="text-text-secondary mb-6">You don&apos;t have permission to edit this clip.</p>
        <Button
          color="primary"
          onPress={() => router.push("/dashboard/clips")}
          startContent={<Icon icon="solar:arrow-left-outline" />}
        >
          Back to Clips
        </Button>
      </div>
    );
  }

  // No clip found
  if (!clip) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <p className="text-text-secondary">Clip not found</p>
      </div>
    );
  }

  const videoUrl = clip.blankVideoUrl || clip.clipUrl;

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="light"
              isIconOnly
              onPress={() => router.push("/dashboard/clips")}
            >
              <Icon icon="solar:arrow-left-outline" className="text-xl" />
            </Button>
            <h1 className="text-xl font-bold text-text-primary">
              {clip.title || `Clip #${clip.id}`}
            </h1>
          </div>
          <Button
            color="primary"
            onPress={handleApplyChanges}
            isDisabled={saving}
            startContent={saving ? <Spinner size="sm" /> : <Icon icon="solar:diskette-bold" />}
          >
            {saving ? "Applying..." : "Apply Changes"}
          </Button>
        </div>

        {/* Main Editor Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Video Preview (Left - 2 cols on large screens) */}
          <div className="lg:col-span-2">
            <EditorVideoPreview
              videoRef={videoRef}
              videoUrl={videoUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlayPause={togglePlayPause}
              isPlaying={isPlaying}
              currentTime={currentTime}
            />

            {/* Timeline */}
            <div className="mt-4">
              <EditorTimeline
                videoRef={videoRef}
                onSeek={seekToTime}
              />
            </div>
          </div>

          {/* Tool Panel (Right - 1 col) */}
          <div className="lg:col-span-1">
            <EditorToolPanel />
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        classNames={{
          base: "bg-surface-base border border-border-base",
          header: "border-b border-border-base",
          body: "py-6",
          footer: "border-t border-border-base",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                <Icon icon="solar:check-circle-bold" className="text-primary-400 text-xl" />
              </div>
              <span className="text-text-primary">Changes Submitted</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <p className="text-text-secondary">
              Your changes are being applied to the video. This usually takes 1-2 minutes.
            </p>
            <p className="text-text-tertiary text-sm mt-2">
              You&apos;ll be redirected to view your clips where you can track the progress.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              onPress={handleSuccessModalClose}
              startContent={<Icon icon="solar:arrow-right-outline" />}
            >
              View My Clips
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
