"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
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
  initializeSegmentsAtom,
  activeSegmentsAtom,
  speedStateAtom,
  cropStateAtom,
  audioStateAtom,
  segmentsStateAtom,
  segmentHistoryAtom,
  segmentHistoryIndexAtom,
  generateSegmentId,
  mediaOverlaysAtom,
  selectedOverlayIdAtom,
  MediaOverlay,
} from "@/store/videoEditor";
import { EditorToolPanel } from "./EditorToolPanel";
import { EditorTimelineV2 } from "./EditorTimelineV2";
import { EditorVideoPreview } from "./EditorVideoPreview";

// Import timeline editor CSS
// @ts-ignore - CSS import from external library
import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css";

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

  // Additional state for restoring saved config
  const setSpeed = useSetAtom(speedStateAtom);
  const setCropState = useSetAtom(cropStateAtom);
  const setAudioState = useSetAtom(audioStateAtom);
  const setSegmentsState = useSetAtom(segmentsStateAtom);
  const setSegmentHistory = useSetAtom(segmentHistoryAtom);
  const setSegmentHistoryIndex = useSetAtom(segmentHistoryIndexAtom);

  // Overlays
  const setOverlays = useSetAtom(mediaOverlaysAtom);
  const setSelectedOverlayId = useSetAtom(selectedOverlayIdAtom);

  // Thumbnails
  const setThumbnails = useSetAtom(thumbnailsAtom);
  const setIsGeneratingThumbnails = useSetAtom(isGeneratingThumbnailsAtom);

  // Segments
  const initializeSegments = useSetAtom(initializeSegmentsAtom);
  const activeSegments = useAtomValue(activeSegmentsAtom);

  // Edit config
  const editConfig = useAtomValue(editConfigAtom);

  // Active tool
  const [activeTool, setActiveTool] = useAtom(activeToolAtom);

  // Video ref
  const videoRef = useRef<HTMLVideoElement>(null);

  // Track if we're in a gap (for showing black screen)
  const [isInGap, setIsInGap] = useState(false);
  const gapIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Generate thumbnails for timeline at 1 frame per second
  const generateThumbnails = useCallback(
    async (duration: number) => {
      if (!videoRef.current || !clip) return;

      setIsGeneratingThumbnails(true);
      const fps = 1;
      const thumbnailCount = Math.min(Math.ceil(duration * fps), 60);
      const interval = duration / thumbnailCount;
      const newThumbnails: string[] = [];

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsGeneratingThumbnails(false);
        return;
      }

      canvas.width = 320;
      canvas.height = 180;

      const video = document.createElement("video");
      video.src = clip.blankVideoUrl || clip.clipUrl || "";
      video.crossOrigin = "anonymous";
      video.muted = true;

      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("Video load failed"));
          video.load();
        });

        for (let i = 0; i < thumbnailCount; i++) {
          const time = i * interval;
          video.currentTime = time;
          await new Promise<void>((resolve) => {
            video.onseeked = () => {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              newThumbnails.push(canvas.toDataURL("image/jpeg", 0.8));
              resolve();
            };
          });
        }

        setThumbnails(newThumbnails);
      } catch (err) {
        console.error("Failed to generate thumbnails:", err);
      } finally {
        setIsGeneratingThumbnails(false);
      }
    },
    [clip, setThumbnails, setIsGeneratingThumbnails]
  );

  // Handle video metadata loaded — restore saved editor config if available
  const handleLoadedMetadata = useCallback(async () => {
    if (!videoRef.current) return;

    const duration = videoRef.current.duration;
    setVideoDuration(duration);

    const metadata = clip?.clip_metadata as any;
    const savedConfig = metadata?.editorConfig;

    // Restore trim or default to full video
    if (savedConfig?.trim) {
      setTrimState(savedConfig.trim);
    } else {
      setTrimState({ startTime: 0, endTime: duration });
    }

    // Restore segments or initialize single full-video segment
    if (savedConfig?.segments && savedConfig.segments.length > 0) {
      const restoredSegments = savedConfig.segments.map((s: any) => ({
        id: s.id || generateSegmentId(),
        startTime: s.startTime,
        endTime: s.endTime,
        speed: s.speed ?? 1.0,
      }));
      setSegmentsState({ segments: restoredSegments, selectedSegmentId: null });
      setSegmentHistory([restoredSegments]);
      setSegmentHistoryIndex(0);
    } else {
      initializeSegments(duration);
    }

    // Restore speed, crop, audio from saved config
    if (savedConfig?.speed) {
      setSpeed(savedConfig.speed);
    }
    if (savedConfig?.crop) {
      setCropState(savedConfig.crop);
    }
    if (savedConfig?.audio) {
      setAudioState(savedConfig.audio);
    }

    // Reset overlays and restore from saved config
    setOverlays([]);
    setSelectedOverlayId(null);
    if (savedConfig?.overlays && savedConfig.overlays.length > 0 && selectedTeam?.id) {
      // Fetch presigned view URLs for saved overlay S3 keys (only for non-comment overlays)
      const s3Keys = savedConfig.overlays
        .filter((o: any) => o.type !== "comment" && o.s3Key)
        .map((o: any) => o.s3Key);
      let urlMap: Record<string, string> = {};
      try {
        if (s3Keys.length > 0) {
          urlMap = await clipsAPI.getOverlayViewUrls(selectedTeam.id, clipId, s3Keys);
        }
      } catch (err) {
        console.error("Failed to fetch overlay URLs:", err);
      }

      // Fetch profile picture URLs for comment overlays
      const pfpS3Keys = savedConfig.overlays
        .filter((o: any) => o.type === "comment" && o.commentData?.profilePictureS3Key)
        .map((o: any) => o.commentData.profilePictureS3Key);
      let pfpUrlMap: Record<string, string> = {};
      try {
        if (pfpS3Keys.length > 0) {
          pfpUrlMap = await clipsAPI.getOverlayViewUrls(selectedTeam.id, clipId, pfpS3Keys);
        }
      } catch (err) {
        console.error("Failed to fetch profile picture URLs:", err);
      }

      const restoredOverlays: MediaOverlay[] = savedConfig.overlays.map((o: any) => ({
        id: o.id,
        type: o.type,
        s3Key: o.s3Key || "",
        fileName: o.fileName,
        url: o.type === "comment" ? "" : (urlMap[o.s3Key] || ""),
        startTime: o.startTime,
        endTime: o.endTime,
        x: o.x,
        y: o.y,
        scale: o.scale,
        opacity: o.opacity,
        naturalWidth: o.naturalWidth,
        naturalHeight: o.naturalHeight,
        ...(o.type === "comment" && o.commentData ? {
          commentData: {
            ...o.commentData,
            profilePictureUrl: o.commentData.profilePictureS3Key
              ? pfpUrlMap[o.commentData.profilePictureS3Key] || undefined
              : undefined,
          },
        } : {}),
      }));
      setOverlays(restoredOverlays);
    }

    // Restore caption settings from editorConfig (overrides initial parameters)
    if (savedConfig?.captions) {
      if (savedConfig.captions.color) setCaptionColor(savedConfig.captions.color);
      if (savedConfig.captions.font) setCaptionFont(savedConfig.captions.font);
      if (savedConfig.captions.enabled !== undefined) setCaptionsEnabled(savedConfig.captions.enabled);
    }

    generateThumbnails(duration);
  }, [
    clip, clipId, selectedTeam?.id, setVideoDuration, setTrimState, initializeSegments, generateThumbnails,
    setSegmentsState, setSegmentHistory, setSegmentHistoryIndex,
    setSpeed, setCropState, setAudioState,
    setCaptionColor, setCaptionFont, setCaptionsEnabled,
    setOverlays, setSelectedOverlayId,
  ]);

  // Helper: check if time is in any active segment
  const isTimeInSegment = useCallback(
    (time: number) => {
      return activeSegments.some((s) => time >= s.startTime && time < s.endTime);
    },
    [activeSegments]
  );

  // Helper: find next segment after given time
  const findNextSegment = useCallback(
    (time: number) => {
      const sorted = [...activeSegments].sort((a, b) => a.startTime - b.startTime);
      return sorted.find((s) => s.startTime > time);
    },
    [activeSegments]
  );

  // Clear gap interval on unmount or when stopping
  const clearGapInterval = useCallback(() => {
    if (gapIntervalRef.current) {
      clearInterval(gapIntervalRef.current);
      gapIntervalRef.current = null;
    }
  }, []);

  // Handle time update - pause video in gaps but keep playhead moving
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    const inSegment = isTimeInSegment(time);

    if (inSegment) {
      // We're in a valid segment
      if (isInGap) {
        setIsInGap(false);
        clearGapInterval();
      }
    } else if (!videoRef.current.paused) {
      // Entering a gap - pause the video but we'll handle gap traversal separately
      const nextSegment = findNextSegment(time);
      if (nextSegment) {
        // Pause video, start gap interval
        videoRef.current.pause();
        setIsInGap(true);

        // Start interval to advance playhead through the gap
        clearGapInterval();
        const gapStart = time;
        const gapEnd = nextSegment.startTime;
        const startRealTime = Date.now();

        gapIntervalRef.current = setInterval(() => {
          const elapsed = (Date.now() - startRealTime) / 1000;
          const newTime = gapStart + elapsed;

          if (newTime >= gapEnd) {
            // Gap finished - resume video
            clearGapInterval();
            setIsInGap(false);
            if (videoRef.current) {
              videoRef.current.currentTime = gapEnd;
              setCurrentTime(gapEnd);
              videoRef.current.play();
            }
          } else {
            setCurrentTime(newTime);
          }
        }, 33); // ~30fps update
      } else {
        // Past all segments — stop playback
        videoRef.current.pause();
        setIsPlaying(false);
        setIsInGap(false);
        clearGapInterval();
      }
    }
  }, [setCurrentTime, isTimeInSegment, findNextSegment, isInGap, setIsPlaying, clearGapInterval]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => clearGapInterval();
  }, [clearGapInterval]);

  // Seek to time
  const seekToTime = useCallback(
    (time: number) => {
      clearGapInterval();
      setIsInGap(false);
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
    },
    [setCurrentTime, clearGapInterval]
  );

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      clearGapInterval();
      setIsInGap(false);
      setIsPlaying(false);
    } else {
      const time = videoRef.current.currentTime;

      // If past all segments, loop back to start
      const sorted = [...activeSegments].sort((a, b) => a.startTime - b.startTime);
      const lastSegment = sorted[sorted.length - 1];
      if (lastSegment && time >= lastSegment.endTime) {
        videoRef.current.currentTime = sorted[0].startTime;
        setCurrentTime(sorted[0].startTime);
      }

      videoRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, setIsPlaying, activeSegments, setCurrentTime, clearGapInterval]);

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
    router.push("/dashboard/create-clip");
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
              isInGap={isInGap}
            />

            {/* Timeline */}
            <div className="mt-4">
              <EditorTimelineV2
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
