"use client";

import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { clipsAPI } from "@/api/clips";
import {
  videoDurationAtom,
  trimStateAtom,
  captionsEnabledAtom,
  captionColorAtom,
  captionFontAtom,
  speedStateAtom,
  cropStateAtom,
  audioStateAtom,
  segmentsStateAtom,
  segmentHistoryAtom,
  segmentHistoryIndexAtom,
  generateSegmentId,
  mediaOverlaysAtom,
  selectedOverlayIdAtom,
  initializeSegmentsAtom,
  MediaOverlay,
  editorClipAtom,
  thumbnailsAtom,
  isGeneratingThumbnailsAtom,
} from "@/store/videoEditor";
import { generateThumbnails } from "@/lib/videoUtils";

/**
 * useEditorConfigRestore
 *
 * Returns a handleLoadedMetadata callback that reads the video element's
 * duration, restores all saved editor configuration (trim, segments, speed,
 * crop, audio, overlays, captions), and generates timeline thumbnails.
 *
 * Usage:
 *   const handleLoadedMetadata = useEditorConfigRestore(clipId, videoRef);
 *   <video onLoadedMetadata={handleLoadedMetadata} ... />
 */
export function useEditorConfigRestore(
  clipId: number,
  videoRef: React.RefObject<HTMLVideoElement>
) {
  const clip = useAtomValue(editorClipAtom);
  const selectedTeam = useAtomValue(selectedTeamAtom);

  const setVideoDuration = useSetAtom(videoDurationAtom);
  const setTrimState = useSetAtom(trimStateAtom);
  const setCaptionsEnabled = useSetAtom(captionsEnabledAtom);
  const setCaptionColor = useSetAtom(captionColorAtom);
  const setCaptionFont = useSetAtom(captionFontAtom);
  const setSpeed = useSetAtom(speedStateAtom);
  const setCropState = useSetAtom(cropStateAtom);
  const setAudioState = useSetAtom(audioStateAtom);
  const setSegmentsState = useSetAtom(segmentsStateAtom);
  const setSegmentHistory = useSetAtom(segmentHistoryAtom);
  const setSegmentHistoryIndex = useSetAtom(segmentHistoryIndexAtom);
  const setOverlays = useSetAtom(mediaOverlaysAtom);
  const setSelectedOverlayId = useSetAtom(selectedOverlayIdAtom);
  const initializeSegments = useSetAtom(initializeSegmentsAtom);
  const setThumbnails = useSetAtom(thumbnailsAtom);
  const setIsGeneratingThumbnails = useSetAtom(isGeneratingThumbnailsAtom);

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
        ...(o.type === "comment" && o.commentData
          ? {
              commentData: {
                ...o.commentData,
                profilePictureUrl: o.commentData.profilePictureS3Key
                  ? pfpUrlMap[o.commentData.profilePictureS3Key] || undefined
                  : undefined,
              },
            }
          : {}),
      }));
      setOverlays(restoredOverlays);
    }

    // Restore caption settings from editorConfig (overrides initial parameters)
    if (savedConfig?.captions) {
      if (savedConfig.captions.color) setCaptionColor(savedConfig.captions.color);
      if (savedConfig.captions.font) setCaptionFont(savedConfig.captions.font);
      if (savedConfig.captions.enabled !== undefined) {
        setCaptionsEnabled(savedConfig.captions.enabled);
      }
    }

    // Generate timeline thumbnails
    const videoSrc = clip?.blankVideoUrl || clip?.clipUrl || "";
    if (videoSrc) {
      setIsGeneratingThumbnails(true);
      try {
        const thumbs = await generateThumbnails(videoSrc, duration);
        setThumbnails(thumbs);
      } catch (err) {
        console.error("Failed to generate thumbnails:", err);
      } finally {
        setIsGeneratingThumbnails(false);
      }
    }
  }, [
    clip,
    clipId,
    selectedTeam?.id,
    videoRef,
    setVideoDuration,
    setTrimState,
    initializeSegments,
    setSegmentsState,
    setSegmentHistory,
    setSegmentHistoryIndex,
    setSpeed,
    setCropState,
    setAudioState,
    setCaptionColor,
    setCaptionFont,
    setCaptionsEnabled,
    setOverlays,
    setSelectedOverlayId,
    setThumbnails,
    setIsGeneratingThumbnails,
  ]);

  return handleLoadedMetadata;
}
