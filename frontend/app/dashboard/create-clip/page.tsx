"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import { Button, Card, CardBody, Progress, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";
import { videoAPI } from "@/api/video";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useUsageStatsRefresh } from "@/contexts/UsageStatsContext";
import {
  UploadSection,
  SettingsPanel,
  TextOverlayPanel,
  GeneratedClipCard,
} from "@/components/create-clip";

interface UploadedVideo {
  s3Key: string;
  fileName: string;
  fileSize: number;
}

export default function CreateClipPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);
  const [selectedTeam] = useAtom(selectedTeamAtom);

  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);
  const [length, setLength] = useState(40);
  const [hookLength, setHookLength] = useState(6);
  const [promptType, setPromptType] = useState<"business" | "viral">("business");
  const [customPrompt, setCustomPrompt] = useState("");
  const [numberOfVideos, setNumberOfVideos] = useState(1);
  const [customText, setCustomText] = useState("");
  const [textPosition, setTextPosition] = useState<"top" | "middle" | "bottom">("top");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [captions, setCaptions] = useState(false);
  const [captionColor, setCaptionColor] = useState("#FFD600");
  const [captionFont, setCaptionFont] = useState("Luckiest Guy");

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [generatedClips, setGeneratedClips] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  const { usageStats, isLoading: isLoadingUsage, refetch: refetchUsageStats } = useUsageStats(selectedTeam?.id);
  const { triggerRefresh, refreshTrigger } = useUsageStatsRefresh();

  useEffect(() => {
    if (!user) {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
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

  const handleUploadComplete = (s3Key: string, fileName: string, fileSize: number) => {
    setUploadedVideo({ s3Key, fileName, fileSize });
    setError("");
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleSubmit = async () => {
    if (!uploadedVideo) {
      setError("Please upload a video first");
      return;
    }

    if (!selectedTeam) {
      setError("No team selected");
      return;
    }

    if (usageStats && usageStats.remaining <= 0) {
      setError(`Usage limit reached. You have ${usageStats.clipsCreated}/${usageStats.limit} clips used.`);
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      await videoAPI.submitClipJob({
        teamId: selectedTeam.id,
        s3Key: uploadedVideo.s3Key,
        originalFileName: uploadedVideo.fileName,
        fileSize: uploadedVideo.fileSize,
        length,
        hookLength,
        promptType,
        customPrompt: customPrompt || undefined,
        numberOfVideos,
        customText: customText || undefined,
        textPosition,
        textColor,
        captions,
        captionColor,
        captionFont,
      });

      triggerRefresh();

      addToast({
        title: "Clips queued for processing",
        description: `${numberOfVideos} clip${numberOfVideos > 1 ? "s" : ""} will be ready soon.`,
        color: "success",
      });

      router.push("/dashboard/clips");
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
    setCustomPrompt("");
    setCustomText("");
    setError("");
  };

  if (!user || !selectedTeam) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-dark">
        <div className="flex flex-col items-center gap-4">
          <Icon icon="solar:loading-circle-bold" className="text-4xl animate-spin text-accent-400" />
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
            <h1 className="text-3xl font-bold text-text-primary mb-2">Create Clip</h1>
            <p className="text-text-secondary">
              Upload a video and let AI create viral clips for social media
            </p>
          </div>
          {usageStats && (
            <Card className="bg-surface-base border border-border-accent">
              <CardBody className="p-4">
                <p className="text-sm text-text-secondary mb-1">Usage This Period</p>
                <p className="text-2xl font-bold text-text-primary">
                  {usageStats.clipsCreated} / {usageStats.limit}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {usageStats.remaining} clips remaining
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        {error && (
          <Card className="mb-6 bg-red-500/10 border border-red-500">
            <CardBody className="p-4 flex items-center gap-3">
              <Icon icon="solar:danger-circle-bold" className="text-2xl text-red-500" />
              <p className="text-red-500">{error}</p>
            </CardBody>
          </Card>
        )}

        {showResults && generatedClips.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">Your Generated Clips</h2>
                <p className="text-text-secondary">
                  {generatedClips.length} clip{generatedClips.length > 1 ? "s" : ""} created successfully
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="bordered" onPress={handleCreateAnother} startContent={<Icon icon="solar:add-circle-bold" />}>
                  Create Another
                </Button>
                <Button color="primary" onPress={() => router.push("/dashboard/clips")} startContent={<Icon icon="solar:folder-bold" />}>
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
            {!uploadedVideo ? (
              <div className="lg:col-span-3">
                <UploadSection
                  teamId={selectedTeam.id}
                  onUploadComplete={handleUploadComplete}
                  onError={handleUploadError}
                />
              </div>
            ) : (
              <>
                <div className="lg:col-span-1">
                  <Card className="bg-surface-base border border-border-base mb-4">
                    <CardBody className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                          <Icon icon="solar:check-circle-bold" className="text-xl text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {uploadedVideo.fileName}
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
                          <Icon icon="solar:close-circle-bold" className="text-lg" />
                        </Button>
                      </div>
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
                        captions={captions}
                        setCaptions={setCaptions}
                        captionColor={captionColor}
                        setCaptionColor={setCaptionColor}
                        captionFont={captionFont}
                        setCaptionFont={setCaptionFont}
                      />

                      {isProcessing && (
                        <div className="mt-8">
                          <Progress isIndeterminate color="primary" className="mb-2" />
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
                          isDisabled={!uploadedVideo || isProcessing || (usageStats?.remaining ?? 0) <= 0}
                          isLoading={isProcessing}
                          startContent={!isProcessing && <Icon icon="solar:scissors-bold" />}
                        >
                          {isProcessing ? "Creating Clips..." : "Create Clips"}
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
