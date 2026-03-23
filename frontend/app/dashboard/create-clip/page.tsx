"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import { Button, Card, CardBody, Progress, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";
import { videoAPI, BatchUploadedVideo, ConversionMode } from "@/api/video";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useUsageStatsRefresh } from "@/contexts/UsageStatsContext";
import {
  UploadSection,
  SettingsPanel,
  TextOverlayPanel,
  GeneratedClipCard,
} from "@/components/create-clip";
import { BatchUploadSection } from "@/components/create-clip/BatchUploadSection";
import { PromptType } from "@/constants/promptTypes";
import { Switch, Tooltip } from "@heroui/react";
import PendingClipsSection from "@/components/clips/PendingClipsSection";
import { ClipsToSaveSection } from "@/components/clips/ClipsToSaveSection";
import PreviewClipViewModal from "@/components/clips/PreviewClipViewModal";
import ClipViewModal from "@/components/clips/ClipViewModal";
import { DeleteConfirmModal } from "@/components/clips/DeleteConfirmModal";
import { useClipsData, useClipModals, useTags, useFolders } from "@/hooks/useClips";
import { useSocket } from "@/hooks/useSocket";
import SpotlightTour, { type TourStep } from "@/components/ui/SpotlightTour";
import TourHelpButton from "@/components/ui/TourHelpButton";

const CLIPPING_TOUR_STEPS: TourStep[] = [
  {
    target: "clip-mode-toggle",
    title: "Single or Batch",
    description: "Toggle between clipping a single video or uploading multiple at once.",
    placement: "bottom",
  },
  {
    target: "clip-upload",
    title: "Upload Your Video",
    description: "Drag and drop a video file, or paste a URL. Supports MP4, MOV, WebM up to 2GB.",
    placement: "bottom",
  },
  {
    target: "clip-settings",
    title: "Configure Settings",
    description: "Choose content type, set clip length and hook duration, and pick how many clips to generate.",
    placement: "right",
  },
  {
    target: "clip-overlays",
    title: "Text & Captions",
    description: "Add auto-captions, custom text overlays, and pick fonts and colors.",
    placement: "left",
  },
  {
    target: "clip-create-btn",
    title: "Generate Clips",
    description: "Hit this button to start AI clipping. Your clips will appear in the Processing section below.",
    placement: "top",
  },
];

interface UploadedVideo {
  s3Key: string;
  fileName: string;
  fileSize: number;
}

export default function CreateClipPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);
  const [selectedTeam] = useAtom(selectedTeamAtom);

  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(
    null
  );
  const [batchMode, setBatchMode] = useState(false);
  const [batchVideos, setBatchVideos] = useState<BatchUploadedVideo[]>([]);
  const [length, setLength] = useState(40);
  const [hookLength, setHookLength] = useState(6);
  const [autoLength, setAutoLength] = useState(true);
  const [autoHookLength, setAutoHookLength] = useState(true);
  const [conversionMode, setConversionMode] = useState<ConversionMode>("standard");
  const [promptType, setPromptType] = useState<PromptType>("viral");
  const [customPrompt, setCustomPrompt] = useState("");
  const [numberOfVideos, setNumberOfVideos] = useState(1);
  const [customText, setCustomText] = useState("");
  const [textPosition, setTextPosition] = useState<"top" | "middle" | "bottom">(
    "top"
  );
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textFont, setTextFont] = useState("Montserrat");
  const [textStyle, setTextStyle] = useState<"stroke" | "instagram">("stroke");
  const [textBgColor, setTextBgColor] = useState("#000000");
  const [autoHeading, setAutoHeading] = useState(true);
  const [headingInstructions, setHeadingInstructions] = useState("");
  const [captions, setCaptions] = useState(false);
  const [captionColor, setCaptionColor] = useState("#FFD600");
  const [captionFont, setCaptionFont] = useState("Luckiest Guy");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicS3Key, setMusicS3Key] = useState("");
  const [musicFileName, setMusicFileName] = useState("");
  const [isMusicUploading, setIsMusicUploading] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [generatedClips, setGeneratedClips] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  const {
    usageStats,
    isLoading: isLoadingUsage,
    refetch: refetchUsageStats,
  } = useUsageStats(selectedTeam?.id);
  const { triggerRefresh, refreshTrigger } = useUsageStatsRefresh();

  // Processing clips hooks
  const {
    pendingClips,
    unsavedClips,
    loadPendingClips,
    loadUnsavedClips,
    requestDeleteClip,
    confirmDeleteClip,
    cancelDeleteClip,
    isDeleteModalOpen,
    clipToDelete,
    isDeleting,
    saveClip,
    rejectClip,
  } = useClipsData();

  const {
    isViewModalOpen,
    selectedClip,
    isPreviewModalOpen,
    selectedPreviewClip,
    isSavingPreviewClip,
    setIsSavingPreviewClip,
    openViewModal,
    closeViewModal,
    openPreviewModal,
    closePreviewModal,
  } = useClipModals();

  const { tags, loadTags, createTag, deleteTag, updateClipTags } = useTags();
  const { folders, loadFolders } = useFolders();

  // WebSocket: refresh pending/unsaved clips when backend signals completion
  const lastSocketUpdateRef = useRef<number>(0);
  const handleSocketUpdate = useCallback(() => {
    const now = Date.now();
    if (now - lastSocketUpdateRef.current < 2000) return;
    lastSocketUpdateRef.current = now;

    loadPendingClips();
    loadUnsavedClips();
    triggerRefresh();
  }, [loadPendingClips, loadUnsavedClips, triggerRefresh]);

  useSocket(selectedTeam?.id, handleSocketUpdate);

  useEffect(() => {
    if (!user) {
      const accessToken =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;
      if (!accessToken) {
        router.push("/auth");
        return;
      }
      authAPI
        .getMe()
        .then((userData) => setUser(userData))
        .catch(() => router.push("/auth"));
    }
  }, [user, router, setUser]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      refetchUsageStats();
    }
  }, [refreshTrigger, refetchUsageStats]);

  useEffect(() => {
    if (
      selectedTeam?.plan === "free" &&
      usageStats?.generationsRemaining !== undefined &&
      usageStats.generationsRemaining !== -1
    ) {
      const maxAllowed = Math.min(usageStats.generationsRemaining, 15);
      if (numberOfVideos > maxAllowed && maxAllowed >= 1) {
        setNumberOfVideos(maxAllowed);
      }
    }
  }, [selectedTeam?.plan, usageStats?.generationsRemaining]);

  // Load processing clips
  useEffect(() => {
    if (selectedTeam?.id) {
      loadPendingClips();
      loadUnsavedClips();
      loadTags();
      loadFolders();
    }
  }, [selectedTeam?.id, loadPendingClips, loadUnsavedClips, loadTags, loadFolders]);

  const handleUploadComplete = (
    s3Key: string,
    fileName: string,
    fileSize: number
  ) => {
    setUploadedVideo({ s3Key, fileName, fileSize });
    setError("");
  };

  const handleBatchUploadComplete = (videos: BatchUploadedVideo[]) => {
    setBatchVideos(videos);
    setError("");
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleMusicUpload = async (file: File) => {
    if (!selectedTeam) return;
    setIsMusicUploading(true);
    try {
      const { uploadUrl, s3Key } = await videoAPI.getPresignedUploadUrl(
        selectedTeam.id,
        file.name,
        file.type,
        file.size,
      );
      await videoAPI.uploadToS3(uploadUrl, file);
      setMusicS3Key(s3Key);
    } catch (err: any) {
      console.error("Music upload failed:", err);
      setMusicFile(null);
      setMusicFileName("");
      setMusicS3Key("");
      addToast({ title: "Failed to upload music", description: err.message, color: "danger" });
    } finally {
      setIsMusicUploading(false);
    }
  };

  const handleClipSaved = async () => {
    await loadPendingClips();
    await loadUnsavedClips();
    triggerRefresh();
  };

  const handleSavePreviewClip = async (clipId: number) => {
    if (!selectedTeam?.id) return;
    setIsSavingPreviewClip(true);
    try {
      await saveClip(clipId, triggerRefresh);
      closePreviewModal();
      await handleClipSaved();
    } catch (error) {
      console.error("Failed to save clip:", error);
    } finally {
      setIsSavingPreviewClip(false);
    }
  };

  const handleSubmit = async () => {
    if (batchMode) {
      if (batchVideos.length === 0) {
        setError("Please upload at least one video");
        return;
      }
    } else {
      if (!uploadedVideo) {
        setError("Please upload a video first");
        return;
      }
    }

    if (!selectedTeam) {
      setError("No team selected");
      return;
    }

    if (
      selectedTeam.plan === "free" &&
      usageStats &&
      usageStats.generationsRemaining !== -1 &&
      usageStats.generationsRemaining <= 0
    ) {
      setError(
        `Generation limit reached. You have generated ${usageStats.clipsGenerated}/${usageStats.generationLimit} clips. Upgrade to generate more.`
      );
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      if (batchMode) {
        // Batch mode - submit multiple videos
        await videoAPI.submitBatchClipJob({
          teamId: selectedTeam.id,
          videos: batchVideos.map((v) => ({
            s3Key: v.s3Key,
            videoIndex: v.videoIndex,
            originalFileName: v.fileName,
            fileSize: v.fileSize,
            duration: v.duration,
          })),
          length: autoLength ? undefined : length,
          hookLength: autoHookLength ? undefined : hookLength,
          promptType,
          customPrompt: customPrompt || undefined,
          textPrompt: customPrompt || undefined,
          numberOfVideos,
          customText: !autoHeading ? customText || undefined : undefined,
          textPosition,
          textColor,
          textFont,
          captions,
          captionColor,
          captionFont,
          conversionMode,
          textStyle,
          textBgColor: textStyle === "instagram" ? textBgColor : undefined,
          autoHeading,
          headingInstructions: autoHeading && headingInstructions ? headingInstructions : undefined,
          backgroundMusicS3Key: musicS3Key || undefined,
        });

        addToast({
          title: "Batch clips queued for processing",
          description: `${numberOfVideos} clip${numberOfVideos > 1 ? "s" : ""} from ${batchVideos.length} videos will be ready soon.`,
          color: "success",
        });
      } else {
        // Single mode
        await videoAPI.submitClipJob({
          teamId: selectedTeam.id,
          s3Key: uploadedVideo!.s3Key,
          originalFileName: uploadedVideo!.fileName,
          fileSize: uploadedVideo!.fileSize,
          length: autoLength ? undefined : length,
          hookLength: autoHookLength ? undefined : hookLength,
          promptType,
          customPrompt: customPrompt || undefined,
          numberOfVideos,
          customText: !autoHeading ? customText || undefined : undefined,
          textPosition,
          textColor,
          textFont,
          captions,
          captionColor,
          captionFont,
          conversionMode,
          textStyle,
          textBgColor: textStyle === "instagram" ? textBgColor : undefined,
          autoHeading,
          headingInstructions: autoHeading && headingInstructions ? headingInstructions : undefined,
          backgroundMusicS3Key: musicS3Key || undefined,
        });

        addToast({
          title: "Clips queued for processing",
          description: `${numberOfVideos} clip${numberOfVideos > 1 ? "s" : ""} will be ready soon.`,
          color: "success",
        });
      }

      triggerRefresh();

      // Reload processing clips and scroll to processing section
      await loadPendingClips();
      await loadUnsavedClips();

      // Reset upload state
      setUploadedVideo(null);
      setBatchVideos([]);
      setIsProcessing(false);

      // Scroll to processing section
      setTimeout(() => {
        const processingSection = document.getElementById('processing-section');
        if (processingSection) {
          processingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err: any) {
      console.error("Submit error:", err);
      setError(err.message || "Failed to create clip");
      setIsProcessing(false);

      addToast({
        title: "Failed to create clip",
        description: err.message || "Something went wrong",
        color: "danger",
      });
    }
  };

  const handleCreateAnother = () => {
    setShowResults(false);
    setGeneratedClips([]);
    setUploadedVideo(null);
    setBatchVideos([]);
    setCustomPrompt("");
    setCustomText("");
    setMusicFile(null);
    setMusicS3Key("");
    setMusicFileName("");
    setError("");
  };

  // Check if we have videos ready (either single or batch)
  const hasVideosReady = batchMode
    ? batchVideos.length > 0
    : uploadedVideo !== null;

  if (!user || !selectedTeam) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-dark">
        <div className="flex flex-col items-center gap-4">
          <Icon
            icon="solar:loading-circle-bold"
            className="text-4xl animate-spin text-accent-400"
          />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 lg:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-1 sm:mb-2 flex items-center gap-2">
              AI Clipping
              <TourHelpButton onPress={() => setIsTourOpen(true)} />
            </h1>
            <p className="text-sm sm:text-base text-text-secondary">
              Upload a video and let AI create viral clips for social media
            </p>
          </div>
          {usageStats && (
            <Card className="bg-surface-base border border-border-accent flex-shrink-0">
              <CardBody className="p-3 sm:p-4">
                {selectedTeam?.plan === "free" ? (
                  <div className="flex sm:block items-center gap-3">
                    <p className="text-xs sm:text-sm text-text-secondary sm:mb-1">
                      Generations
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-text-primary">
                      {usageStats.clipsGenerated} / {usageStats.generationLimit}
                    </p>
                    <p className="hidden sm:block text-xs text-text-tertiary mt-1">
                      {usageStats.generationsRemaining} remaining
                    </p>
                  </div>
                ) : (
                  <div className="flex sm:block items-center gap-3">
                    <p className="text-xs sm:text-sm text-text-secondary sm:mb-1">
                      Credits
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-text-primary">
                      {usageStats.clipsCreated} / {usageStats.limit}
                    </p>
                    <p className="hidden sm:block text-xs text-text-tertiary mt-1">
                      {usageStats.remaining} remaining
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {error && (
          <Card className="mb-6 bg-red-500/10 border border-red-500">
            <CardBody className="p-4 flex items-center gap-3">
              <Icon
                icon="solar:danger-circle-bold"
                className="text-2xl text-red-500"
              />
              <p className="text-red-500">{error}</p>
            </CardBody>
          </Card>
        )}

        {showResults && generatedClips.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">
                  Your Generated Clips
                </h2>
                <p className="text-text-secondary">
                  {generatedClips.length} clip
                  {generatedClips.length > 1 ? "s" : ""} created successfully
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="bordered"
                  onPress={handleCreateAnother}
                  startContent={<Icon icon="solar:add-circle-bold" />}
                >
                  Create Another
                </Button>
                <Button
                  color="primary"
                  onPress={() => router.push("/dashboard/clips")}
                  startContent={<Icon icon="solar:folder-bold" />}
                >
                  View All Clips
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedClips.map((clip, index) => (
                <GeneratedClipCard key={clip.id} clip={clip} index={index} />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {!hasVideosReady ? (
              <div className="lg:col-span-3">
                {/* Batch mode toggle */}
                <Card className="bg-surface-base border border-border-base mb-4" data-tour="clip-mode-toggle">
                  <CardBody className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon
                          icon={
                            batchMode
                              ? "solar:layers-bold-duotone"
                              : "solar:videocamera-record-bold-duotone"
                          }
                          className="text-2xl text-accent-400"
                        />
                        <div>
                          <p className="font-medium text-text-primary">
                            {batchMode
                              ? "Batch Upload Mode"
                              : "Single Video Mode"}
                          </p>
                          <p className="text-sm text-text-secondary">
                            {batchMode
                              ? "Upload multiple videos, AI will mix the best moments"
                              : "Upload one video to create clips from"}
                          </p>
                        </div>
                      </div>
                      <Tooltip
                        content={
                          batchMode
                            ? "Switch to single video"
                            : "Switch to batch mode (up to 5 videos)"
                        }
                      >
                        <Switch
                          isSelected={batchMode}
                          onValueChange={(value) => {
                            setBatchMode(value);
                            setUploadedVideo(null);
                            setBatchVideos([]);
                          }}
                          size="lg"
                          color="primary"
                        />
                      </Tooltip>
                    </div>
                  </CardBody>
                </Card>

                <div data-tour="clip-upload">
                  {batchMode ? (
                    <BatchUploadSection
                      teamId={selectedTeam.id}
                      plan={selectedTeam.plan}
                      onUploadComplete={handleBatchUploadComplete}
                      onError={handleUploadError}
                      maxVideos={5}
                      isDisabled={
                        selectedTeam.plan === "free" &&
                        usageStats?.generationsRemaining !== -1 &&
                        (usageStats?.generationsRemaining ?? 0) <= 0
                      }
                      disabledReason={
                        selectedTeam.plan === "free" &&
                        usageStats?.generationsRemaining !== -1 &&
                        (usageStats?.generationsRemaining ?? 0) <= 0
                          ? "You've used all your free generations. Subscribe to a plan to continue."
                          : undefined
                      }
                    />
                  ) : (
                    <UploadSection
                      teamId={selectedTeam.id}
                      plan={selectedTeam.plan}
                      onUploadComplete={handleUploadComplete}
                      onError={handleUploadError}
                      isDisabled={
                        selectedTeam.plan === "free" &&
                        usageStats?.generationsRemaining !== -1 &&
                        (usageStats?.generationsRemaining ?? 0) <= 0
                      }
                      disabledReason={
                        selectedTeam.plan === "free" &&
                        usageStats?.generationsRemaining !== -1 &&
                        (usageStats?.generationsRemaining ?? 0) <= 0
                          ? "You've used all your free generations. Subscribe to a plan to continue."
                          : undefined
                      }
                    />
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="lg:col-span-1">
                  <Card className="bg-surface-base border border-border-base mb-4">
                    <CardBody className="p-4">
                      {batchMode ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon
                                icon="solar:layers-bold-duotone"
                                className="text-xl text-accent-400"
                              />
                              <span className="font-medium text-text-primary">
                                {batchVideos.length} Videos Uploaded
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="light"
                              onPress={handleCreateAnother}
                            >
                              Clear All
                            </Button>
                          </div>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {batchVideos.map((video, idx) => (
                              <div
                                key={video.videoIndex}
                                className="flex items-center gap-2 text-sm"
                              >
                                <span className="w-5 h-5 bg-accent-400/20 rounded text-xs flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="truncate text-text-secondary">
                                  {video.fileName}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                            <Icon
                              icon="solar:check-circle-bold"
                              className="text-xl text-green-500"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {uploadedVideo?.fileName}
                            </p>
                            <p className="text-xs text-text-secondary">
                              Uploaded successfully
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            onPress={handleCreateAnother}
                          >
                            <Icon
                              icon="solar:close-circle-bold"
                              className="text-lg"
                            />
                          </Button>
                        </div>
                      )}
                    </CardBody>
                  </Card>

                  <Card className="bg-surface-base border border-border-base" data-tour="clip-settings">
                    <CardBody className="p-4 sm:p-6">
                      <SettingsPanel
                        promptType={promptType}
                        setPromptType={setPromptType}
                        customPrompt={customPrompt}
                        setCustomPrompt={setCustomPrompt}
                        length={length}
                        setLength={setLength}
                        hookLength={hookLength}
                        setHookLength={setHookLength}
                        autoLength={autoLength}
                        setAutoLength={setAutoLength}
                        autoHookLength={autoHookLength}
                        setAutoHookLength={setAutoHookLength}
                        conversionMode={conversionMode}
                        setConversionMode={setConversionMode}
                        numberOfVideos={numberOfVideos}
                        setNumberOfVideos={setNumberOfVideos}
                        maxClips={
                          selectedTeam.plan === "free" &&
                          usageStats?.generationsRemaining !== -1
                            ? usageStats?.generationsRemaining
                            : undefined
                        }
                        batchMode={batchMode}
                      />
                    </CardBody>
                  </Card>
                </div>

                <div className="lg:col-span-2">
                  <Card className="bg-surface-base border border-border-base h-full" data-tour="clip-overlays">
                    <CardBody className="p-4 sm:p-6">
                      <TextOverlayPanel
                        customText={customText}
                        setCustomText={setCustomText}
                        headingInstructions={headingInstructions}
                        setHeadingInstructions={setHeadingInstructions}
                        textPosition={textPosition}
                        setTextPosition={setTextPosition}
                        textColor={textColor}
                        setTextColor={setTextColor}
                        textFont={textFont}
                        setTextFont={setTextFont}
                        textStyle={textStyle}
                        setTextStyle={setTextStyle}
                        textBgColor={textBgColor}
                        setTextBgColor={setTextBgColor}
                        autoHeading={autoHeading}
                        setAutoHeading={setAutoHeading}
                        captions={captions}
                        setCaptions={setCaptions}
                        captionColor={captionColor}
                        setCaptionColor={setCaptionColor}
                        captionFont={captionFont}
                        setCaptionFont={setCaptionFont}
                        musicFile={musicFile}
                        setMusicFile={setMusicFile}
                        musicS3Key={musicS3Key}
                        setMusicS3Key={setMusicS3Key}
                        musicFileName={musicFileName}
                        setMusicFileName={setMusicFileName}
                        onMusicUpload={handleMusicUpload}
                        isMusicUploading={isMusicUploading}
                      />

                      {isProcessing && (
                        <div className="mt-8">
                          <Progress
                            isIndeterminate
                            color="primary"
                            className="mb-2"
                          />
                          <p className="text-sm text-text-secondary text-center">
                            Submitting job...
                          </p>
                        </div>
                      )}

                      <div className="mt-8">
                        <Button
                          fullWidth
                          size="lg"
                          color="primary"
                          data-tour="clip-create-btn"
                          onPress={handleSubmit}
                          isDisabled={
                            !hasVideosReady ||
                            isProcessing ||
                            (selectedTeam.plan === "free" &&
                              usageStats?.generationsRemaining !== -1 &&
                              (usageStats?.generationsRemaining ?? 0) <= 0)
                          }
                          isLoading={isProcessing}
                          startContent={
                            !isProcessing && <Icon icon="solar:scissors-bold" />
                          }
                        >
                          {isProcessing
                            ? "Creating Clips..."
                            : batchMode
                              ? `Create Clips from ${batchVideos.length} Videos`
                              : "Create Clips"}
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {/* Processing Section - moved from Library */}
        {selectedTeam && (
          <div id="processing-section" className="mt-12">
            <div className="border-t border-border-base pt-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-warning-500/10">
                  <Icon icon="solar:hourglass-bold-duotone" className="text-2xl text-warning-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Processing</h2>
                  <p className="text-sm text-text-secondary">
                    {(() => {
                      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
                      const visiblePendingCount = pendingClips.filter(
                        (c) => c.status !== "failed" || new Date(c.updated_at) >= twoDaysAgo
                      ).length;
                      const total = visiblePendingCount + unsavedClips.length;
                      return total > 0
                        ? `${total} clip${total === 1 ? '' : 's'} being processed`
                        : "No clips processing";
                    })()}
                  </p>
                </div>
              </div>

              {(() => {
                const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
                const hasVisiblePending = pendingClips.some(
                  (c) => c.status !== "failed" || new Date(c.updated_at) >= twoDaysAgo
                );
                return hasVisiblePending || unsavedClips.length > 0;
              })() ? (
                <div className="space-y-6">
                  <PendingClipsSection
                    clips={pendingClips}
                    onClipClick={(clip: any) => openViewModal(clip)}
                    onCancel={(clipId) => requestDeleteClip(clipId, undefined, triggerRefresh)}
                  />

                  <ClipsToSaveSection
                    clips={unsavedClips}
                    teamId={selectedTeam.id}
                    onClipSaved={handleClipSaved}
                    onClipRejected={rejectClip}
                    onClipView={openPreviewModal}
                    onUsageUpdated={triggerRefresh}
                  />
                </div>
              ) : (
                <Card className="bg-surface-base border border-border-base">
                  <CardBody className="flex flex-col items-center justify-center py-12">
                    <Icon
                      icon="solar:check-circle-bold-duotone"
                      className="text-5xl text-success-500 mb-3"
                    />
                    <p className="text-text-secondary text-center mb-1 text-base">
                      All caught up!
                    </p>
                    <p className="text-text-tertiary text-center text-sm max-w-md">
                      Upload a video above to generate new clips
                    </p>
                  </CardBody>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedClip && (
        <ClipViewModal
          isOpen={isViewModalOpen}
          onClose={closeViewModal}
          clip={selectedClip}
          folders={folders}
          availableTags={tags}
          onMoveToFolder={() => {}}
          onTagsChange={updateClipTags}
          onCreateTag={createTag}
          onDeleteTag={deleteTag}
          onGenerateShareLink={() => Promise.resolve("")}
          onRemoveShareLink={() => Promise.resolve()}
          onUpdateTitle={() => Promise.resolve()}
          onEdit={() => { closeViewModal(); router.push(`/dashboard/clips/${selectedClip.id}/edit`); }}
        />
      )}

      {selectedPreviewClip && (
        <PreviewClipViewModal
          isOpen={isPreviewModalOpen}
          onClose={closePreviewModal}
          clip={selectedPreviewClip}
          onSave={handleSavePreviewClip}
          onReject={rejectClip}
          isSaving={isSavingPreviewClip}
        />
      )}

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={cancelDeleteClip}
        onConfirm={confirmDeleteClip}
        isDeleting={isDeleting}
        clipName={clipToDelete?.name}
      />

      <SpotlightTour
        steps={CLIPPING_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}
