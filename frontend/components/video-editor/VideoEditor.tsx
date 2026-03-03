"use client";

import React, { useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { Button, Spinner, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { clipsAPI } from "@/api/clips";
import {
  editorClipAtom,
  editorLoadingAtom,
  editorAccessDeniedAtom,
  currentTimeAtom,
  isPlayingAtom,
  isSavingAtom,
  showSuccessModalAtom,
  editConfigAtom,
} from "@/store/videoEditor";
import { EditorToolPanel } from "./EditorToolPanel";
import { EditorTimelineV2 } from "./EditorTimelineV2";
import { EditorVideoPreview } from "./EditorVideoPreview";
import { EditorSuccessModal } from "./EditorSuccessModal";
import { useEditorClipLoader } from "@/hooks/useEditorClipLoader";
import { useEditorConfigRestore } from "@/hooks/useEditorConfigRestore";
import { useGapAwarePlayback } from "@/hooks/useGapAwarePlayback";

// @ts-ignore - CSS import from external library
import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css";

export function VideoEditor() {
  const params = useParams();
  const router = useRouter();
  const clipId = parseInt(params.clipId as string);
  const [selectedTeam] = useAtom(selectedTeamAtom);

  const clip = useAtomValue(editorClipAtom);
  const loading = useAtomValue(editorLoadingAtom);
  const accessDenied = useAtomValue(editorAccessDeniedAtom);
  const [saving, setSaving] = useAtom(isSavingAtom);
  const [showSuccessModal, setShowSuccessModal] = useAtom(showSuccessModalAtom);
  const currentTime = useAtomValue(currentTimeAtom);
  const isPlaying = useAtomValue(isPlayingAtom);
  const editConfig = useAtomValue(editConfigAtom);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Load clip and initialise caption/heading atoms
  useEditorClipLoader(clipId);

  // Restore saved editor config when video metadata is available
  const handleLoadedMetadata = useEditorConfigRestore(clipId, videoRef);

  // Gap-aware playback (skips deleted segments)
  const { isInGap, handleTimeUpdate, seekToTime, togglePlayPause } =
    useGapAwarePlayback(videoRef);

  const handleApplyChanges = async () => {
    if (!selectedTeam?.id || !clip) return;
    setSaving(true);
    try {
      await clipsAPI.submitVideoEdit(selectedTeam.id, clip.id, editConfig);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Failed to apply changes:", error);
      addToast({
        title: "Failed to apply",
        description:
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    router.push("/dashboard/clips");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <Icon icon="solar:lock-keyhole-bold-duotone" className="text-red-500" width={32} />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Access Denied</h2>
        <p className="text-text-secondary mb-6">
          You don&apos;t have permission to edit this clip.
        </p>
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
          {/* Video Preview — 2 cols on large screens */}
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
              <EditorTimelineV2 videoRef={videoRef} onSeek={seekToTime} />
            </div>
          </div>

          {/* Tool Panel — 1 col */}
          <div className="lg:col-span-1">
            <EditorToolPanel />
          </div>
        </div>
      </div>

      <EditorSuccessModal isOpen={showSuccessModal} onClose={handleSuccessModalClose} />
    </div>
  );
}
