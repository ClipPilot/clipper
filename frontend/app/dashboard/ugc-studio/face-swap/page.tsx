"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { faceSwapAPI } from "@/api/ugc/faceSwap";
import { extractFirstFrame } from "@/lib/videoUtils";
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
  const [isGeneratingPose, setIsGeneratingPose] = useState(false);
  const [generatedPoseUrl, setGeneratedPoseUrl] = useState<string | null>(null);
  const [generatedPoseFile, setGeneratedPoseFile] = useState<File | null>(null);
  const faceSwapsSectionRef = useRef<MyFaceSwapsSectionRef>(null);

  const getCharacterImages = (): Array<File | { imageKey: string }> => {
    return selectedCharacters
      .filter((c) => c.file || c.imageKey)
      .map((c, index) => {
        if (index === 0 && generatedPoseFile) {
          return generatedPoseFile;
        }
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
    // Clear pose when video changes
    setGeneratedPoseUrl(null);
    setGeneratedPoseFile(null);
  };

  const handleCharactersChange = (characters: SelectedCharacter[]) => {
    setSelectedCharacters(characters);
    // Clear pose when characters change
    setGeneratedPoseUrl(null);
    setGeneratedPoseFile(null);
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

    // Create temp IDs for each job
    const tempIds = characterImages.map((_, i) => `temp-${Date.now()}-${i}`);

    // Add optimistic jobs for all characters
    tempIds.forEach((tempId) => {
      faceSwapsSectionRef.current?.addOptimisticJob(tempId);
    });

    // Clear form
    setVideo(null);
    setSelectedCharacters([]);
    setVideoDuration(0);
    setSegments([]);
    setGeneratedPoseUrl(null);
    setGeneratedPoseFile(null);

    try {
      const result = await faceSwapAPI.createMultipleJobs({
        video: videoFile,
        images: characterImages,
        teamId,
        segments: segmentsData,
        videoDuration: duration,
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
    const characterImages = getCharacterImages();
    if (!video?.file || characterImages.length === 0 || !selectedTeam?.id)
      return;

    const videoFile = video.file;
    const teamId = selectedTeam.id;
    const duration = videoDuration;
    const videoToRevoke = video.preview;
    const characterCount = characterImages.length;
    const totalCredits = characterCount * 5;
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
    setGeneratedPoseUrl(null);
    setGeneratedPoseFile(null);

    try {
      const result = await faceSwapAPI.createMultipleJobsAutoDetect({
        video: videoFile,
        images: characterImages,
        teamId,
        videoDuration: duration,
        spliceWithOriginal: true,
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
  }, [video, selectedCharacters, selectedTeam?.id, videoDuration, generatedPoseFile]);

  const handleGeneratePose = useCallback(async () => {
    if (!video?.preview || selectedCharacters.length === 0 || !selectedTeam?.id) {
      return;
    }

    setIsGeneratingPose(true);
    try {
      // Extract first frame from video
      const frameDataUrl = await extractFirstFrame(video.preview);

      // Get the first selected character
      const character = selectedCharacters[0];
      const characterImage = character.imageKey
        ? { imageKey: character.imageKey }
        : character.file!;

      // Call API
      const result = await faceSwapAPI.generatePose({
        teamId: selectedTeam.id,
        videoFrame: frameDataUrl,
        characterImage,
      });

      // Fetch the generated image and store as File for face swap
      const response = await fetch(result.imageUrl);
      if (!response.ok) {
        throw new Error("Failed to download generated pose image");
      }
      const blob = await response.blob();
      const file = new File([blob], "posed-character.png", { type: "image/png" });

      setGeneratedPoseUrl(result.imageUrl);
      setGeneratedPoseFile(file);

      addToast({
        title: "Pose generated!",
        description: "This pose will be used when you generate the face swap",
        color: "success",
      });
    } catch (error) {
      console.error("Generate pose error:", error);
      addToast({
        title: "Failed to generate pose",
        description: error instanceof Error ? error.message : "An error occurred",
        color: "danger",
      });
    } finally {
      setIsGeneratingPose(false);
    }
  }, [video, selectedCharacters, selectedTeam?.id]);

  const handleClearPose = useCallback(() => {
    setGeneratedPoseUrl(null);
    setGeneratedPoseFile(null);
  }, []);

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
              onCharactersChange={handleCharactersChange}
              teamId={selectedTeam?.id}
            />
            <GeneratePanel
              hasVideo={!!video}
              characterCount={selectedCharacters.length}
              segmentCount={segments.length}
              totalDuration={totalDuration}
              onGenerate={handleGenerate}
              onAutoDetectAndGenerate={handleAutoDetectAndGenerate}
              showEditor={showEditor}
              onToggleEditor={() => setShowEditor(false)}
              onGeneratePose={handleGeneratePose}
              isGeneratingPose={isGeneratingPose}
              generatedPoseUrl={generatedPoseUrl}
              onClearPose={handleClearPose}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
