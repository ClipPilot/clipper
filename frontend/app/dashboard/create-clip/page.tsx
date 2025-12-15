"use client";

import React, { useState, useEffect, useRef } from "react";
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

const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB

export default function CreateClipPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
  const [success, setSuccess] = useState("");
  const [generatedClips, setGeneratedClips] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  const { usageStats, isLoading: isLoadingUsage, refetch: refetchUsageStats } = useUsageStats(selectedTeam?.id);
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
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          router.push("/auth");
        });
    }
  }, [user, router, setUser]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      refetchUsageStats();
    }
  }, [refreshTrigger, refetchUsageStats]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size must be less than 1.5GB. Your file is ${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB`);
      return;
    }

    // Validate file type
    const validTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a valid video file (MP4, MOV, AVI, MKV, WebM)");
      return;
    }

    setSelectedFile(file);
    setError("");
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("Please select a video file");
      return;
    }

    if (!selectedTeam) {
      setError("No team selected");
      return;
    }

    if (usageStats && usageStats.remaining <= 0) {
      setError(`Usage limit reached. You have ${usageStats.clipsCreated}/${usageStats.limit} clips used. Resets on ${new Date(usageStats.resetsDate).toLocaleDateString()}`);
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      await videoAPI.clipVideo({
        teamId: selectedTeam.id,
        video: selectedFile,
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
        description: `${numberOfVideos} clip${numberOfVideos > 1 ? "s" : ""} will be ready soon. We'll notify you when done.`,
        type: "success",
      });

      router.push("/dashboard/clips");
    } catch (err: any) {
      console.error("Clip creation error:", err);
      setError(err.message || "Failed to create clip");
      setIsProcessing(false);

      addToast({
        title: "Failed to create clip",
        description: err.message || "Something went wrong",
        type: "error",
      });
    }
  };

  const handleCreateAnother = () => {
    setShowResults(false);
    setGeneratedClips([]);
    setSelectedFile(null);
    setCustomPrompt("");
    setCustomText("");
    setError("");
    setSuccess("");
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
        {/* Header */}
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

        {/* Error/Success Messages */}
        {error && (
          <Card className="mb-6 bg-red-500/10 border border-red-500">
            <CardBody className="p-4 flex items-center gap-3">
              <Icon icon="solar:danger-circle-bold" className="text-2xl text-red-500" />
              <p className="text-red-500">{error}</p>
            </CardBody>
          </Card>
        )}

        {success && !showResults && (
          <Card className="mb-6 bg-green-500/10 border border-green-500">
            <CardBody className="p-4 flex items-center gap-3">
              <Icon icon="solar:check-circle-bold" className="text-2xl text-green-500" />
              <p className="text-green-500">{success}</p>
            </CardBody>
          </Card>
        )}

        {/* Results View */}
        {showResults && generatedClips.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">
                  Your Generated Clips
                </h2>
                <p className="text-text-secondary">
                  {generatedClips.length} clip{generatedClips.length > 1 ? 's' : ''} created successfully
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
            {/* Upload Section or Controls */}
            {!selectedFile ? (
              <div className="lg:col-span-3">
                <UploadSection
                  selectedFile={selectedFile}
                  onFileSelect={handleFileSelect}
                  fileInputRef={fileInputRef}
                />
              </div>
            ) : (
              <>
                {/* Controls Panel */}
                <div className="lg:col-span-1">
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

                {/* Text Overlay Panel */}
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

                      {/* Progress */}
                      {isProcessing && (
                        <div className="mt-8">
                          <Progress
                            isIndeterminate
                            color="primary"
                            className="mb-2"
                          />
                          <p className="text-sm text-text-secondary text-center">
                            Uploading video...
                          </p>
                        </div>
                      )}

                      {/* Submit Button */}
                      <div className="mt-8">
                        <Button
                          fullWidth
                          size="lg"
                          color="primary"
                          onPress={handleSubmit}
                          isDisabled={!selectedFile || isProcessing || (usageStats?.remaining ?? 0) <= 0}
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

