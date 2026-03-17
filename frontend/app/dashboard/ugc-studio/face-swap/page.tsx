"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { faceSwapAPI } from "@/api/ugc/faceSwap";
import type { SelectedCharacter } from "@/components/ugc-studio/types";
import {
  UploadedFile,
  VideoSegment,
  ScalePlanRequired,
  VideoUploadCard,
  CharacterSelector,
  GeneratePanel,
  MyFaceSwapsSection,
  MyFaceSwapsSectionRef,
} from "@/components/ugc-studio";
import SpotlightTour, { type TourStep } from "@/components/ui/SpotlightTour";
import TourHelpButton from "@/components/ui/TourHelpButton";

const FACE_SWAP_TOUR_STEPS: TourStep[] = [
  {
    target: "faceswap-upload",
    title: "Upload Your Video",
    description: "Upload a video up to 5 minutes. This is the video whose face will be swapped.",
    placement: "right",
  },
  {
    target: "faceswap-characters",
    title: "Select Characters",
    description: "Choose from saved faces, example characters, or upload a new face image.",
    placement: "left",
  },
  {
    target: "faceswap-generate",
    title: "Choose Mode & Generate",
    description: "Pick Face Swap (faster) or Full Body mode, then hit Generate. Costs 5 credits per character.",
    placement: "left",
  },
  {
    target: "faceswap-my-swaps",
    title: "My Swaps",
    description: "Track your swap jobs here. Processing typically takes 5\u201340 minutes depending on mode.",
    placement: "top",
  },
];

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
  const [selectedCharacters, setSelectedCharacters] = useState<
    SelectedCharacter[]
  >([]);
  const [videoDuration, setVideoDuration] = useState(0);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [swapType, setSwapType] = useState<"face" | "fullbody">("fullbody");
  const [isTourOpen, setIsTourOpen] = useState(false);
  const faceSwapsSectionRef = useRef<MyFaceSwapsSectionRef>(null);

  const getCharacterImages = (): Array<File | { imageKey: string }> => {
    return selectedCharacters
      .filter((c) => c.file || c.imageKey)
      .map((c) => {
        if (c.imageKey) {
          return { imageKey: c.imageKey };
        }
        return c.file as File;
      });
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

  const handleCharactersChange = (characters: SelectedCharacter[]) => {
    setSelectedCharacters(characters);
  };

  const handleGenerate = async () => {
    const characterImages = getCharacterImages();
    if (
      !video ||
      characterImages.length === 0 ||
      !selectedTeam?.id ||
      segments.length === 0
    )
      return;

    const videoFile = video.file;
    const teamId = selectedTeam.id;
    const segmentsData = segments.map((s) => ({ start: s.start, end: s.end }));
    const duration = videoDuration;
    const videoToRevoke = video.preview;
    const characterCount = characterImages.length;
    const totalCredits = characterCount * 5;

    const voiceIds = selectedCharacters.map((c) => c.voiceId || null);
    const tempIds = characterImages.map((_, i) => `temp-${Date.now()}-${i}`);

    tempIds.forEach((tempId) => {
      faceSwapsSectionRef.current?.addOptimisticJob(tempId);
    });

    setVideo(null);
    setSelectedCharacters([]);
    setVideoDuration(0);
    setSegments([]);

    try {
      const result = await faceSwapAPI.createMultipleJobs({
        video: videoFile,
        images: characterImages,
        teamId,
        segments: segmentsData,
        videoDuration: duration,
        spliceWithOriginal: true,
        folderId: selectedFolderId,
        voiceIds,
      });

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
    const characterImages = getCharacterImages();
    if (!video?.file || characterImages.length === 0 || !selectedTeam?.id)
      return;

    const videoFile = video.file;
    const teamId = selectedTeam.id;
    const duration = videoDuration;
    const videoToRevoke = video.preview;
    const characterCount = characterImages.length;
    const totalCredits = characterCount * 5;
    const voiceIds = selectedCharacters.map((c) => c.voiceId || null);
    const tempIds = characterImages.map((_, i) => `temp-${Date.now()}-${i}`);

    tempIds.forEach((tempId, i) => {
      faceSwapsSectionRef.current?.addOptimisticJob(
        tempId,
        i === 0 ? "Uploading..." : "Waiting..."
      );
    });

    setVideo(null);
    setSelectedCharacters([]);
    setVideoDuration(0);
    setSegments([]);

    try {
      const result = await faceSwapAPI.createMultipleJobsAutoDetect({
        video: videoFile,
        images: characterImages,
        teamId,
        videoDuration: duration,
        spliceWithOriginal: true,
        folderId: selectedFolderId,
        voiceIds,
      });

      result.jobIds.forEach((jobId, i) => {
        if (tempIds[i]) {
          faceSwapsSectionRef.current?.updateOptimisticJob(tempIds[i], jobId);
        }
      });

      addToast({
        title: `${characterCount} swap${characterCount > 1 ? "s" : ""} started!`,
        description: `Processing ${characterCount} video${characterCount > 1 ? "s" : ""}. Face detection and swap will run in background. (${totalCredits} credits)`,
        color: "success",
      });

      if (videoToRevoke) URL.revokeObjectURL(videoToRevoke);
    } catch (error) {
      console.error("Auto-detect and generate error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      tempIds.forEach((tempId) => {
        faceSwapsSectionRef.current?.failOptimisticJob(tempId, errorMessage);
      });
      addToast({
        title: "Failed",
        description: errorMessage,
        color: "danger",
      });
    }
  }, [video, selectedCharacters, selectedTeam?.id, videoDuration, selectedFolderId]);

  const handleFaceSwapGenerate = useCallback(async () => {
    const characterImages = getCharacterImages();
    if (!video?.file || characterImages.length === 0 || !selectedTeam?.id)
      return;

    const videoFile = video.file;
    const teamId = selectedTeam.id;
    const duration = videoDuration;
    const videoToRevoke = video.preview;
    const characterCount = characterImages.length;
    const totalCredits = characterCount * 5;
    const voiceIds = selectedCharacters.map((c) => c.voiceId || null);
    const tempIds = characterImages.map((_, i) => `temp-${Date.now()}-${i}`);

    tempIds.forEach((tempId) => {
      faceSwapsSectionRef.current?.addOptimisticJob(tempId);
    });

    setVideo(null);
    setSelectedCharacters([]);
    setVideoDuration(0);
    setSegments([]);

    try {
      const result = await faceSwapAPI.createMultipleJobsAutoDetect({
        video: videoFile,
        images: characterImages,
        teamId,
        videoDuration: duration,
        spliceWithOriginal: true,
        folderId: selectedFolderId,
        voiceIds,
        swapType: "face",
      });

      result.jobIds.forEach((jobId, i) => {
        if (tempIds[i]) {
          faceSwapsSectionRef.current?.updateOptimisticJob(tempIds[i], jobId);
        }
      });

      addToast({
        title: `${characterCount} face swap${characterCount > 1 ? "s" : ""} started!`,
        description: `Processing... This typically takes 5-10 minutes. (${totalCredits} credits)`,
        color: "success",
      });

      if (videoToRevoke) URL.revokeObjectURL(videoToRevoke);
    } catch (error) {
      console.error("Face swap generate error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      tempIds.forEach((tempId) => {
        faceSwapsSectionRef.current?.failOptimisticJob(tempId, errorMessage);
      });
      addToast({
        title: "Failed to start face swap",
        description: errorMessage,
        color: "danger",
      });
    }
  }, [video, selectedCharacters, selectedTeam?.id, videoDuration, selectedFolderId]);

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
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              Character Swap
              <TourHelpButton onPress={() => setIsTourOpen(true)} />
            </h1>
            <p className="text-text-secondary text-sm">
              Upload a video and swap faces with a character
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div data-tour="faceswap-upload">
              <VideoUploadCard
                video={video}
                videoDuration={videoDuration}
                segments={segments}
                onVideoChange={handleVideoChange}
                onSegmentsChange={setSegments}
                showEditor={showEditor && swapType === "fullbody"}
                onToggleEditor={swapType === "fullbody" ? () => setShowEditor((v) => !v) : undefined}
                teamId={selectedTeam?.id}
              />
            </div>
            {selectedTeam?.id && (
              <div className="space-y-4" data-tour="faceswap-my-swaps">
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
            <div data-tour="faceswap-characters">
              <CharacterSelector
                selectedCharacters={selectedCharacters}
                onCharactersChange={handleCharactersChange}
                teamId={selectedTeam?.id}
              />
            </div>

            <div data-tour="faceswap-generate">
              <GeneratePanel
                hasVideo={!!video}
                characterCount={selectedCharacters.length}
                segmentCount={segments.length}
                totalDuration={totalDuration}
                onGenerate={handleGenerate}
                onAutoDetectAndGenerate={handleAutoDetectAndGenerate}
                onFaceSwapGenerate={handleFaceSwapGenerate}
                showEditor={showEditor}
                onToggleEditor={() => setShowEditor(false)}
                swapType={swapType}
                onSwapTypeChange={setSwapType}
                teamId={selectedTeam?.id}
                selectedFolderId={selectedFolderId}
                onFolderSelect={setSelectedFolderId}
              />
            </div>
          </div>
        </div>
      </div>

      <SpotlightTour
        steps={FACE_SWAP_TOUR_STEPS}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
}
