"use client";

import { useState, useEffect, useRef } from "react";
import { Button, Card, CardBody, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { apiFetch } from "@/lib/apiClient";
import API_URL from "@/config/constants";
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

type StudioView = "menu" | "face-swap";

export default function UGCStudioPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);

  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return <ScalePlanRequired currentPlan={selectedTeam?.plan || "free"} />;
  }

  return <UGCStudioContent selectedTeam={selectedTeam} />;
}

function UGCStudioContent({
  selectedTeam,
}: {
  selectedTeam: { id: number; plan?: string };
}) {
  const [currentView, setCurrentView] = useState<StudioView>("face-swap");
  const [video, setVideo] = useState<UploadedFile | null>(null);
  const [selectedCharacter, setSelectedCharacter] =
    useState<SelectedCharacter | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [swapType, setSwapType] = useState<SwapType>("face");
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

    // Generate a temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;

    // Capture values before clearing state
    const videoFile = video.file;
    const imageFile = characterImage.file;
    const teamId = selectedTeam.id.toString();
    const segmentsData = JSON.stringify(segments.map((s) => ({ start: s.start, end: s.end })));
    const duration = videoDuration.toString();
    const swap = swapType;
    const videoToRevoke = video.preview;

    // Immediately show the job card with "uploading" status
    faceSwapsSectionRef.current?.addOptimisticJob(tempId);

    // Clear form immediately so user can queue another job
    setVideo(null);
    setSelectedCharacter(null);
    setVideoDuration(0);
    setSegments([]);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("image", imageFile);
      formData.append("teamId", teamId);
      formData.append("segments", segmentsData);
      formData.append("videoDuration", duration);
      formData.append("swapType", swap);
      // Always include original video before/after segments, even with single segment
      formData.append("spliceWithOriginal", "true");

      const response = await apiFetch(`${API_URL}/comfy/ugc-face-swap`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit job");
      }

      const data = await response.json();

      // Update the optimistic job with the real ID and "queued" status
      faceSwapsSectionRef.current?.updateOptimisticJob(tempId, data.jobId);

      addToast({
        title: "Face swap started!",
        description:
          "Your video is being processed. This may take 20-40 minutes.",
        color: "success",
      });

      if (videoToRevoke) URL.revokeObjectURL(videoToRevoke);
    } catch (err) {
      console.error("Generate error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";

      // Update the optimistic job to show the failure
      faceSwapsSectionRef.current?.failOptimisticJob(tempId, errorMessage);

      addToast({
        title: "Failed to start face swap",
        description: errorMessage,
        color: "danger",
      });
    }
  };

  const totalDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);

  if (currentView === "menu") {
    return (
      <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">
              UGC Studio
            </h1>
            <p className="text-text-secondary mt-1">
              Create AI-powered user-generated content
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StudioFeatureCard
              icon="solar:mask-happly-bold-duotone"
              iconColor="text-accent-400"
              iconBg="bg-accent-400/10"
              title="Face Swap"
              description="Swap faces in your videos with AI"
              onPress={() => setCurrentView("face-swap")}
            />
            <ComingSoonCard
              icon="solar:microphone-3-bold-duotone"
              title="Voice Clone"
              description="Clone voices and add custom narration"
            />
            <ComingSoonCard
              icon="solar:gallery-bold-duotone"
              title="AI Backgrounds"
              description="Generate custom backgrounds for your content"
            />
          </div>

          {selectedTeam?.id && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-text-primary">
                My Face Swaps
              </h2>
              <MyFaceSwapsSection ref={faceSwapsSectionRef} teamId={selectedTeam.id} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
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
                <MyFaceSwapsSection ref={faceSwapsSectionRef} teamId={selectedTeam.id} />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <CharacterSelector
              selectedCharacter={selectedCharacter}
              onCharacterChange={setSelectedCharacter}
            />
            <GeneratePanel
              hasVideo={!!video}
              hasCharacter={!!characterImage}
              segmentCount={segments.length}
              totalDuration={totalDuration}
              swapType={swapType}
              onSwapTypeChange={setSwapType}
              onGenerate={handleGenerate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioFeatureCard({
  icon,
  iconColor,
  iconBg,
  title,
  description,
  onPress,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Card
      className="bg-surface-base border border-border-base hover:border-accent-400/30 transition-all cursor-pointer group"
      isPressable
      onPress={onPress}
    >
      <CardBody className="p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div
            className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}
          >
            <Icon icon={icon} className={iconColor} width={36} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              {title}
            </h3>
            <p className="text-sm text-text-secondary">{description}</p>
          </div>
          <div className="flex items-center gap-2 text-accent-400 text-sm font-medium">
            <span>Get Started</span>
            <Icon
              icon="solar:arrow-right-bold"
              width={16}
              className="group-hover:translate-x-1 transition-transform"
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function ComingSoonCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Card className="bg-surface-base border border-border-base opacity-60">
      <CardBody className="p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center">
            <Icon icon={icon} className="text-text-tertiary" width={36} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-tertiary mb-1">
              {title}
            </h3>
            <p className="text-sm text-text-muted">{description}</p>
          </div>
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-surface-elevated text-text-tertiary">
            Coming Soon
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
