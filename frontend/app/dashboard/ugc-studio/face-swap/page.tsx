"use client";

import { useState, useEffect, useRef } from "react";
import { Button, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { faceSwapAPI } from "@/api/ugc/faceSwap";
import {
  UploadedFile,
  SelectedCharacter,
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
  const [selectedCharacter, setSelectedCharacter] =
    useState<SelectedCharacter | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [swapType, setSwapType] = useState<SwapType>("face");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const faceSwapsSectionRef = useRef<MyFaceSwapsSectionRef>(null);

  const characterImage = selectedCharacter
    ? {
        file: selectedCharacter.file || new File([], "example.jpg"),
        preview: selectedCharacter.src,
      }
    : null;

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
    if (!video || !characterImage || !selectedTeam?.id || segments.length === 0)
      return;

    setError(null);
    setIsProcessing(true);
    setProcessingStatus("Uploading files...");
    setSubmittedJobId(null);

    try {
      await faceSwapAPI.createJob({
        video: video.file,
        image: characterImage.file,
        teamId: selectedTeam.id,
        segments: segments.map((s) => ({ start: s.start, end: s.end })),
        videoDuration,
        swapType,
        spliceWithOriginal: true,
      });

      setProcessingStatus("Job submitted! Processing...");

      addToast({
        title: "Face swap started!",
        description:
          "Your video is being processed. This may take 20-40 minutes.",
        color: "success",
      });

      faceSwapsSectionRef.current?.refetch();

      if (video?.preview) URL.revokeObjectURL(video.preview);
      setVideo(null);
      setSelectedCharacter(null);
      setVideoDuration(0);
      setSegments([]);
    } catch (err) {
      console.error("Generate error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      addToast({
        title: "Failed to start face swap",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
    }
  };

  const totalDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);

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
            <h1 className="text-2xl font-bold text-text-primary">Face Swap</h1>
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
            />
            {selectedTeam?.id && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">
                  My Face Swaps
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
              selectedCharacter={selectedCharacter}
              onCharacterChange={setSelectedCharacter}
            />
            <GeneratePanel
              isProcessing={isProcessing}
              processingStatus={processingStatus}
              submittedJobId={submittedJobId}
              error={error}
              hasVideo={!!video}
              hasCharacter={!!characterImage}
              segmentCount={segments.length}
              totalDuration={totalDuration}
              swapType={swapType}
              onSwapTypeChange={setSwapType}
              onGenerate={handleGenerate}
              onClearSubmitted={() => setSubmittedJobId(null)}
              onClearError={() => setError(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
