"use client";

import { useState, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  scriptsAtom,
  selectedVariantIndexAtom,
  selectedVoiceAtom,
  videoStatusAtom,
  freshStartAtom,
  isSilentAtom,
} from "@/store/ugc";
import { videoStateAtom } from "@/store/videoState";
import { ugcVideoAPI } from "@/api/ugc/video";
import { useUsageStats } from "@/hooks/useUsageStats";
import { CreditCostCard } from "@/components/ugc-studio/generate/CreditCostCard";
import { calculateCreditCost } from "@/lib/creditCost";

interface GenerateVideoStepProps {
  teamId: number;
  scriptId: string;
}

export function GenerateVideoStep({ teamId, scriptId }: GenerateVideoStepProps) {
  const router = useRouter();
  const scripts = useAtomValue(scriptsAtom);
  const selectedVariantIndex = useAtomValue(selectedVariantIndexAtom);
  const selectedVoice = useAtomValue(selectedVoiceAtom);
  const isSilent = useAtomValue(isSilentAtom);
  const videoStatus = useAtomValue(videoStatusAtom);
  const [freshStart, setFreshStart] = useAtom(freshStartAtom);
  const videoState = useAtomValue(videoStateAtom);

  const { usageStats } = useUsageStats(teamId);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentScript = scripts[selectedVariantIndex];
  const scenes = currentScript?.scenes || [];
  const totalScenes = scenes.reduce((total: number, scene: any) => total + (scene.mergedSceneTypes?.length || 1), 0);
  const creditCost = calculateCreditCost(scenes);

  useEffect(() => {
    if (isGenerating) return;
    if (freshStart) return;
    if (videoStatus !== null) return;

    const checkExistingVideo = async () => {
      try {
        const existingVideo = await ugcVideoAPI.getScriptVideo(scriptId);
        if (existingVideo && existingVideo.jobId) {
          router.push(`/dashboard/ugc-studio/ai-video-creator/${existingVideo.jobId}`);
        }
      } catch {
        // No existing video
      }
    };

    checkExistingVideo();
  }, [scriptId, isGenerating, freshStart, videoStatus, router]);

  const handleGenerateClick = async () => {
    if (!isSilent && !selectedVoice) {
      setError("Please select a voice first");
      return;
    }
    if (!usageStats || usageStats.totalRemaining < creditCost) {
      setError(`Not enough credits. You need ${creditCost} credits to generate this video.`);
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const voiceConfig = videoState.characters.length > 1
        ? videoState.characters.map((c) => ({
            characterId: c.character.id,
            voiceId: c.voiceId || "",
          }))
        : undefined;

      const response = await ugcVideoAPI.generateVideo({
        teamId,
        scriptId,
        voiceId: selectedVoice?.id,
        voiceConfig,
        isSilent: isSilent || undefined,
      });

      setFreshStart(false);
      router.push(`/dashboard/ugc-studio/ai-video-creator/${response.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start video generation");
      setIsGenerating(false);
    }
  };


  if (!currentScript || scenes.length === 0) {
    return (
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="py-16 flex flex-col items-center justify-center text-center">
          <Icon
            icon="solar:danger-triangle-bold-duotone"
            className="text-amber-400 mb-4"
            width={48}
          />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            No Script Found
          </h3>
          <p className="text-text-secondary text-sm">
            Please go back and generate a script first
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!isSilent && !selectedVoice) {
    return (
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="py-16 flex flex-col items-center justify-center text-center">
          <Icon
            icon="solar:soundwave-bold-duotone"
            className="text-amber-400 mb-4"
            width={48}
          />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            No Voice Selected
          </h3>
          <p className="text-text-secondary text-sm">
            Please go back and select a voice first
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Generate Your Video
        </h2>
        <p className="text-text-secondary">
          Ready to bring your script to life with AI video generation
        </p>
      </div>

      {error && (
        <Card className="bg-red-500/10 border border-red-500/30">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <Icon icon="solar:danger-triangle-bold" className="text-red-400" width={24} />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Video Summary</h3>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-surface-base rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
                <Icon icon="solar:document-text-bold-duotone" className="text-accent-400" width={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Script</p>
                <p className="text-xs text-text-secondary">
                  {currentScript.title || "Untitled Script"} • {totalScenes} scenes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-surface-base rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Icon icon={isSilent ? "solar:volume-cross-bold-duotone" : "solar:soundwave-bold-duotone"} className="text-purple-400" width={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{isSilent ? "Audio" : "Voice"}</p>
                <p className="text-xs text-text-secondary">
                  {isSilent ? "Silent mode — no voiceover" : `${selectedVoice!.name} • ${selectedVoice!.gender}`}
                </p>
              </div>
            </div>

          </div>
        </CardBody>
      </Card>

      <CreditCostCard
        creditCost={creditCost}
        creditsRemaining={usageStats?.totalRemaining}
        isLoading={!usageStats}
        isDisabled={isGenerating || !usageStats || usageStats.totalRemaining < creditCost}
        isGenerating={isGenerating}
        onGenerate={handleGenerateClick}
        gradientClasses="from-accent-400/20 to-purple-500/20"
        borderClass="border-accent-400/30"
        iconBgClass="bg-accent-400/30"
        iconTextClass="text-accent-400"
        buttonClass="bg-accent-400 text-white font-semibold"
      />

    </div>
  );
}
