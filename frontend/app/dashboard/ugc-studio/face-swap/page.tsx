"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { faceSwapAPI } from "@/api/ugc/faceSwap";
import { apiFetch } from "@/lib/apiClient";
import API_URL from "@/config/constants";
import type { SelectedCharacter } from "@/components/ugc-studio/types";
import {
  UploadedFile,
  VideoSegment,
  SwapType,
  ScalePlanRequired,
  VideoUploadCard,
  CharacterSelector,
  GeneratePanel,
  MyFaceSwapsSection,
  MyFaceSwapsSectionRef,
} from "@/components/ugc-studio";

export default function FaceSwapPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const router = useRouter();

  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return <ScalePlanRequired currentPlan={selectedTeam?.plan || "free"} />;
  }

  return <FaceSwapContent selectedTeam={selectedTeam} router={router} />;
}

function FaceSwapContent({
  selectedTeam,
  router,
}: {
  selectedTeam: { id: number; plan?: string };
  router: ReturnType<typeof useRouter>;
}) {
  const [video, setVideo] = useState<UploadedFile | null>(null);
  const [selectedCharacters, setSelectedCharacters] = useState<SelectedCharacter[]>([]);
  const [videoDuration, setVideoDuration] = useState(0);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [swapType, setSwapType] = useState<SwapType>("face");
  const [showEditor, setShowEditor] = useState(false);
  const faceSwapsSectionRef = useRef<MyFaceSwapsSectionRef>(null);

  // Get character files for API calls
  const getCharacterFiles = () => {
    return selectedCharacters
      .filter((c) => c.file)
      .map((c) => c.file as File);
  };

  useEffect(() => {
    return () => {
      if (video?.preview) URL.revokeObjectURL(video.preview);
    };
  }, []);

  const handleVideoChange = (
    newVideo: UploadedFile | null,
    duration: number
  ) => {
    setVideo(newVideo);
    setVideoDuration(duration);
  };

  const handleGenerate = async () => {
    const characterFiles = getCharacterFiles();
    if (!video || characterFiles.length === 0 || !selectedTeam?.id || segments.length === 0)
      return;

    const videoFile = video.file;
    const teamId = selectedTeam.id;
    const segmentsData = segments.map((s) => ({ start: s.start, end: s.end }));
    const duration = videoDuration;
    const swap = swapType;
    const videoToRevoke = video.preview;
    const characterCount = characterFiles.length;
    const totalCredits = characterCount * 5;

    // Create temp IDs for each job
    const tempIds = characterFiles.map((_, i) => `temp-${Date.now()}-${i}`);

    // Add optimistic jobs for all characters
    tempIds.forEach((tempId) => {
      faceSwapsSectionRef.current?.addOptimisticJob(tempId);
    });

    // Clear form
    setVideo(null);
    setSelectedCharacters([]);
    setVideoDuration(0);
    setSegments([]);

    try {
      const result = await faceSwapAPI.createMultipleJobs({
        video: videoFile,
        images: characterFiles,
        teamId,
        segments: segmentsData,
        videoDuration: duration,
        swapType: swap,
        spliceWithOriginal: true,
      });

      // Update each optimistic job with real ID
      result.jobIds.forEach((jobId, i) => {
        if (tempIds[i]) {
          faceSwapsSectionRef.current?.updateOptimisticJob(tempIds[i], jobId);
        }
      });

      addToast({
        title: `${characterCount} swap${characterCount > 1 ? "s" : ""} started!`,
        description: `Processing ${characterCount} video${characterCount > 1 ? "s" : ""}. This may take 20-40 minutes each. (${totalCredits} credits)`,
        color: "success",
      });

      if (videoToRevoke) URL.revokeObjectURL(videoToRevoke);
    } catch (err) {
      console.error("Generate error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";

      // Fail all optimistic jobs
      tempIds.forEach((tempId) => {
        faceSwapsSectionRef.current?.failOptimisticJob(tempId, errorMessage);
      });

      addToast({
        title: "Failed to start swaps",
        description: errorMessage,
        color: "danger",
      });
    }
  };

  const totalDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);

  const handleAutoDetectAndGenerate = useCallback(async () => {
    const characterFiles = getCharacterFiles();
    if (!video?.file || characterFiles.length === 0 || !selectedTeam?.id) return;

    const videoFile = video.file;
    const teamId = selectedTeam.id;
    const duration = videoDuration;
    const swap = swapType;
    const videoToRevoke = video.preview;
    const characterCount = characterFiles.length;
    const totalCredits = characterCount * 5;

    // Create temp IDs for each job
    const tempIds = characterFiles.map((_, i) => `temp-${Date.now()}-${i}`);

    // Add optimistic jobs for all characters
    tempIds.forEach((tempId, i) => {
      faceSwapsSectionRef.current?.addOptimisticJob(
        tempId,
        i === 0 ? "Detecting faces..." : "Waiting..."
      );
    });

    // Clear form
    setVideo(null);
    setSelectedCharacters([]);
    setVideoDuration(0);
    setSegments([]);

    // Process everything in background
    (async () => {
      try {
        // Step 1: Get presigned URL for S3 upload
        tempIds.forEach((tempId) => {
          faceSwapsSectionRef.current?.updateOptimisticJobStatus(tempId, "Uploading video...");
        });

        const uploadUrlResponse = await apiFetch(`${API_URL}/face-swap/detect-faces/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: videoFile.name, teamId }),
        });

        if (!uploadUrlResponse.ok) {
          const errorData = await uploadUrlResponse.json();
          throw new Error(errorData.error || "Failed to get upload URL");
        }

        const { uploadUrl, s3Key } = await uploadUrlResponse.json();

        // Step 2: Upload video directly to S3
        const s3Response = await fetch(uploadUrl, {
          method: "PUT",
          body: videoFile,
          headers: { "Content-Type": "video/mp4" },
        });

        if (!s3Response.ok) {
          throw new Error("Failed to upload video to S3");
        }

        // Step 3: Detect faces from S3
        tempIds.forEach((tempId) => {
          faceSwapsSectionRef.current?.updateOptimisticJobStatus(tempId, "Detecting faces...");
        });

        const detectResponse = await apiFetch(`${API_URL}/face-swap/detect-faces/from-s3`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ s3Key, videoDuration: duration }),
        });

        if (!detectResponse.ok) {
          const errorData = await detectResponse.json();
          throw new Error(errorData.error || "Failed to detect faces");
        }

        const data = await detectResponse.json();

        if (!data.segments || data.segments.length === 0) {
          tempIds.forEach((tempId) => {
            faceSwapsSectionRef.current?.failOptimisticJob(tempId, "No faces detected");
          });
          addToast({
            title: "No faces detected",
            description: "Could not find clear face segments. Try manual selection.",
            color: "warning",
          });
          return;
        }

        // Process segments
        let selectedSegments: { start: number; end: number }[] = [];
        let totalDur = 0;
        const maxTotalDuration = 50;
        const maxSegments = 5;

        for (const seg of data.segments) {
          if (selectedSegments.length >= maxSegments) break;
          const segDuration = seg.end - seg.start;
          if (totalDur + segDuration <= maxTotalDuration) {
            selectedSegments.push({ start: seg.start, end: seg.end });
            totalDur += segDuration;
          } else if (totalDur < maxTotalDuration) {
            const availableDuration = maxTotalDuration - totalDur;
            if (availableDuration >= 0.5) {
              selectedSegments.push({ start: seg.start, end: seg.start + availableDuration });
            }
            break;
          }
        }

        if (selectedSegments.length === 0) {
          tempIds.forEach((tempId) => {
            faceSwapsSectionRef.current?.failOptimisticJob(tempId, "No usable segments");
          });
          addToast({
            title: "No usable segments",
            description: "Detected segments were too short.",
            color: "warning",
          });
          return;
        }

        // Step 4: Create multiple jobs
        tempIds.forEach((tempId) => {
          faceSwapsSectionRef.current?.updateOptimisticJobStatus(tempId, "Creating jobs...");
        });

        const result = await faceSwapAPI.createMultipleJobs({
          video: videoFile,
          images: characterFiles,
          teamId,
          segments: selectedSegments,
          videoDuration: duration,
          swapType: swap,
          spliceWithOriginal: true,
        });

        // Update each optimistic job with real ID
        result.jobIds.forEach((jobId, i) => {
          if (tempIds[i]) {
            faceSwapsSectionRef.current?.updateOptimisticJob(tempIds[i], jobId);
          }
        });

        addToast({
          title: `${characterCount} swap${characterCount > 1 ? "s" : ""} started!`,
          description: `Processing ${characterCount} video${characterCount > 1 ? "s" : ""}. This may take 20-40 minutes each. (${totalCredits} credits)`,
          color: "success",
        });

        if (videoToRevoke) URL.revokeObjectURL(videoToRevoke);
      } catch (error) {
        console.error("Auto-detect and generate error:", error);
        const errorMessage = error instanceof Error ? error.message : "An error occurred";
        tempIds.forEach((tempId) => {
          faceSwapsSectionRef.current?.failOptimisticJob(tempId, errorMessage);
        });
        addToast({
          title: "Failed",
          description: errorMessage,
          color: "danger",
        });
      }
    })();
  }, [video, selectedCharacters, selectedTeam?.id, videoDuration, swapType]);

  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            isIconOnly
            onPress={() => router.push("/dashboard/ugc-studio")}
            className="text-text-secondary hover:text-text-primary"
          >
            <Icon icon="solar:arrow-left-linear" width={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Character Swap
            </h1>
            <p className="text-text-secondary text-sm">
              Upload a video and swap faces with a character
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <VideoUploadCard
              video={video}
              videoDuration={videoDuration}
              segments={segments}
              onVideoChange={handleVideoChange}
              onSegmentsChange={setSegments}
              showEditor={showEditor}
              onToggleEditor={() => setShowEditor((v) => !v)}
            />
            {selectedTeam?.id && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">
                  My Swaps
                </h2>
                <MyFaceSwapsSection
                  ref={faceSwapsSectionRef}
                  teamId={selectedTeam.id}
                />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <CharacterSelector
              selectedCharacters={selectedCharacters}
              onCharactersChange={setSelectedCharacters}
            />
            <GeneratePanel
              hasVideo={!!video}
              characterCount={selectedCharacters.length}
              segmentCount={segments.length}
              totalDuration={totalDuration}
              swapType={swapType}
              onSwapTypeChange={setSwapType}
              onGenerate={handleGenerate}
              onAutoDetectAndGenerate={handleAutoDetectAndGenerate}
              showEditor={showEditor}
              onToggleEditor={() => setShowEditor(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
