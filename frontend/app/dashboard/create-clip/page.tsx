"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import { Button, Card, CardBody, Progress, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";
import { videoAPI, BatchUploadedVideo } from "@/api/video";
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
  const [promptType, setPromptType] = useState<PromptType>("business");
  const [customPrompt, setCustomPrompt] = useState("");
  const [numberOfVideos, setNumberOfVideos] = useState(1);
  const [customText, setCustomText] = useState("");
  const [textPosition, setTextPosition] = useState<"top" | "middle" | "bottom">(
    "top"
  );
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textFont, setTextFont] = useState("Montserrat");
  const [captions, setCaptions] = useState(false);
  const [captionColor, setCaptionColor] = useState("#FFD600");
  const [captionFont, setCaptionFont] = useState("Luckiest Guy");

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [generatedClips, setGeneratedClips] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  const {
    usageStats,
    isLoading: isLoadingUsage,
    refetch: refetchUsageStats,
  } = useUsageStats(selectedTeam?.id);
  const { triggerRefresh, refreshTrigger } = useUsageStatsRefresh();

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
          length,
          hookLength,
          promptType,
          customPrompt: customPrompt || undefined,
          textPrompt: customPrompt || undefined,
          numberOfVideos,
          customText: customText || undefined,
          textPosition,
          textColor,
          textFont,
          captions,
          captionColor,
          captionFont,
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
          length,
          hookLength,
          promptType,
          customPrompt: customPrompt || undefined,
          numberOfVideos,
          customText: customText || undefined,
          textPosition,
          textColor,
          textFont,
          captions,
          captionColor,
          captionFont,
        });

        addToast({
          title: "Clips queued for processing",
          description: `${numberOfVideos} clip${numberOfVideos > 1 ? "s" : ""} will be ready soon.`,
          color: "success",
        });
      }

      triggerRefresh();
      router.push("/dashboard/clips?tab=processing");
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
    <div className="min-h-screen bg-surface-dark p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              Create Clip
            </h1>
            <p className="text-text-secondary">
              Upload a video and let AI create viral clips for social media
            </p>
          </div>
          {usageStats && (
            <Card className="bg-surface-base border border-border-accent">
              <CardBody className="p-4">
                {selectedTeam?.plan === "free" ? (
                  <>
                    <p className="text-sm text-text-secondary mb-1">
                      Generations
                    </p>
                    <p className="text-2xl font-bold text-text-primary">
                      {usageStats.clipsGenerated} / {usageStats.generationLimit}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      {usageStats.generationsRemaining} generations remaining
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary mb-1">
                      Credits
                    </p>
                    <p className="text-2xl font-bold text-text-primary">
                      {usageStats.clipsCreated} / {usageStats.limit}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      {usageStats.remaining} credits remaining
                    </p>
                  </>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {!hasVideosReady ? (
              <div className="lg:col-span-3">
                {/* Batch mode toggle */}
                <Card className="bg-surface-base border border-border-base mb-4">
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

                {batchMode ? (
                  <BatchUploadSection
                    teamId={selectedTeam.id}
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

                  <Card className="bg-surface-base border border-border-base">
                    <CardBody className="p-6">
                      <SettingsPanel
                        promptType={promptType}
                        setPromptType={setPromptType}
                        customPrompt={customPrompt}
                        setCustomPrompt={setCustomPrompt}
                        length={length}
                        setLength={setLength}
                        hookLength={hookLength}
                        setHookLength={setHookLength}
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
                  <Card className="bg-surface-base border border-border-base h-full">
                    <CardBody className="p-6">
                      <TextOverlayPanel
                        customText={customText}
                        setCustomText={setCustomText}
                        textPosition={textPosition}
                        setTextPosition={setTextPosition}
                        textColor={textColor}
                        setTextColor={setTextColor}
                        textFont={textFont}
                        setTextFont={setTextFont}
                        captions={captions}
                        setCaptions={setCaptions}
                        captionColor={captionColor}
                        setCaptionColor={setCaptionColor}
                        captionFont={captionFont}
                        setCaptionFont={setCaptionFont}
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
      </div>
    </div>
  );
}
