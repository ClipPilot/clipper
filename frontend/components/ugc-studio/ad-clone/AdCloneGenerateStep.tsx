"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Spinner,
  Tabs,
  Tab,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import {
  adCloneVoiceIdAtom,
  adCloneStatusAtom,
  adCloneProgressAtom,
  adCloneProgressMessageAtom,
  adCloneFinalVideoUrlAtom,
  adCloneSelectedScriptAtom,
  adCloneCharacterIdAtom,
  adCloneProjectIdAtom,
} from "@/store/adClone";
import { voicesConfig, type Voice } from "@/config/voicesConfig";
import { VoiceCard } from "../voice/VoiceCard";
import { useAdClone } from "@/hooks/useAdClone";
import { useUsageStats } from "@/hooks/useUsageStats";
import { FolderSelector } from "@/components/clips";
import { BrandLogo } from "@/components/brand-logo";
import type { UGCScript, UGCScene } from "../script/types";

type GenderFilter = "all" | "male" | "female";

interface AdCloneGenerateStepProps {
  teamId: number;
}

function VoiceSelectorInline({
  selectedVoice,
  onVoiceChange,
}: {
  selectedVoice: Voice | null;
  onVoiceChange: (voice: Voice | null) => void;
}) {
  const [filter, setFilter] = useState<GenderFilter>("all");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const filteredVoices =
    filter === "all" ? voicesConfig : voicesConfig.filter((v) => v.gender === filter);

  const handlePlayToggle = useCallback(
    (voice: Voice) => {
      if (playingVoiceId === voice.id) {
        audioRef.current?.pause();
        setPlayingVoiceId(null);
        setPlaybackProgress(0);
        return;
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = voice.previewFile;
        audioRef.current.load();

        audioRef.current
          .play()
          .then(() => {
            setPlayingVoiceId(voice.id);
            setPlaybackProgress(0);
          })
          .catch((err) => {
            console.error("Audio playback failed:", err);
            setPlayingVoiceId(null);
          });
      }
    },
    [playingVoiceId]
  );

  const handleSelect = useCallback(
    (voice: Voice) => {
      onVoiceChange(selectedVoice?.id === voice.id ? null : voice);
    },
    [selectedVoice, onVoiceChange]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setPlayingVoiceId(null);
      setPlaybackProgress(0);
    };
    const handleTimeUpdate = () => {
      if (audio.duration) {
        setPlaybackProgress(audio.currentTime / audio.duration);
      }
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, []);

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardHeader className="pb-0 flex-col items-start gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <Icon icon="solar:microphone-3-bold-duotone" className="text-orange-500" width={22} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Select Voice</h3>
            <p className="text-xs text-text-tertiary">Choose the AI voice for your cloned ad</p>
          </div>
        </div>
        <Tabs
          selectedKey={filter}
          onSelectionChange={(key) => setFilter(key as GenderFilter)}
          size="sm"
          variant="light"
          classNames={{ tabList: "gap-2", tab: "px-3", cursor: "bg-orange-500/20" }}
        >
          <Tab key="all" title="All" />
          <Tab key="male" title="Male" />
          <Tab key="female" title="Female" />
        </Tabs>
      </CardHeader>
      <CardBody className="pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredVoices.map((voice) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              isSelected={selectedVoice?.id === voice.id}
              isPlaying={playingVoiceId === voice.id}
              progress={playingVoiceId === voice.id ? playbackProgress : 0}
              onSelect={() => handleSelect(voice)}
              onPlayToggle={() => handlePlayToggle(voice)}
            />
          ))}
        </div>
        <audio ref={audioRef} className="hidden" preload="none" />
      </CardBody>
    </Card>
  );
}

function GeneratingState({
  progress,
  progressMessage,
}: {
  progress: number;
  progressMessage: string;
}) {
  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Spinner size="lg" color="warning" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-base border-2 border-orange-500 flex items-center justify-center">
              <Icon icon="solar:video-frame-play-bold-duotone" className="text-orange-500" width={18} />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-text-primary">
              Generating Your Cloned Ad
            </h2>
            <p className="text-text-secondary">
              Creating video scenes and assembling your ad...
            </p>
          </div>

          <div className="w-full max-w-md space-y-2">
            <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-text-tertiary">
              {progressMessage || `${progress}% complete`}
            </p>
          </div>

          <Card className="bg-surface-elevated border border-border-base w-full max-w-md">
            <CardBody className="p-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-orange-500">1</span>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Generating voice-over audio for each scene
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-orange-500">2</span>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Creating video clips with AI animation
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-orange-500">3</span>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Assembling final video with audio sync
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </CardBody>
    </Card>
  );
}

function VideoPreviewState({
  videoUrl,
  scenes,
  teamId,
}: {
  videoUrl: string;
  scenes: UGCScene[];
  teamId: number;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const totalDuration = scenes.reduce(
    (sum, scene) => sum + scene.estimatedDurationSeconds,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">
            Your Cloned Ad is Ready!
          </h2>
          <p className="text-text-secondary text-sm">
            Preview your video and save it to your library
          </p>
        </div>
        <Chip className="bg-green-500/20 text-green-400" startContent={<Icon icon="solar:check-circle-bold" width={14} />}>
          Complete
        </Chip>
      </div>

      <Card className="bg-surface-base border border-border-base overflow-hidden">
        <CardBody className="p-0">
          <div className="relative aspect-[9/16] max-h-[70vh] mx-auto bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
            />

            {!isPlaying && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/30"
                onClick={handlePlayPause}
              >
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Icon icon="solar:play-bold" className="text-white ml-1" width={36} />
                </div>
              </motion.button>
            )}
          </div>

          <div className="p-4 border-t border-border-base bg-surface-elevated">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:clock-circle-bold" className="text-text-muted" width={16} />
                  <span className="text-sm text-text-secondary">{totalDuration}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:clapperboard-bold" className="text-text-muted" width={16} />
                  <span className="text-sm text-text-secondary">{scenes.length} scenes</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:verified-check-bold" className="text-green-400" width={16} />
                <span className="text-sm text-green-400 font-medium">Video generated</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
              <Icon icon="solar:folder-bold-duotone" className="text-orange-500" width={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary mb-2">
                Save to folder (optional)
              </p>
              <FolderSelector
                teamId={teamId}
                selectedFolderId={selectedFolderId}
                onFolderSelect={setSelectedFolderId}
                placeholder="Root (no folder)"
                size="sm"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-center">
        <Button
          size="lg"
          className="bg-orange-500 text-white font-semibold px-8"
          startContent={<Icon icon="solar:check-circle-bold" width={20} />}
          onPress={() => router.push("/dashboard/clips")}
        >
          Go to My Clips
        </Button>
      </div>
    </div>
  );
}

export function AdCloneGenerateStep({ teamId }: AdCloneGenerateStepProps) {
  const [voiceId, setVoiceId] = useAtom(adCloneVoiceIdAtom);
  const status = useAtomValue(adCloneStatusAtom);
  const progress = useAtomValue(adCloneProgressAtom);
  const progressMessage = useAtomValue(adCloneProgressMessageAtom);
  const finalVideoUrl = useAtomValue(adCloneFinalVideoUrlAtom);
  const selectedScript = useAtomValue(adCloneSelectedScriptAtom) as UGCScript | null;
  const characterId = useAtomValue(adCloneCharacterIdAtom);
  const projectId = useAtomValue(adCloneProjectIdAtom);

  const { generateVideo } = useAdClone(teamId);
  const { usageStats } = useUsageStats(teamId);

  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedVoice = voicesConfig.find((v) => v.id === voiceId) || null;
  const scenes = selectedScript?.scenes || [];
  const creditCost = scenes.length * 2;

  const handleVoiceChange = (voice: Voice | null) => {
    setVoiceId(voice?.id ?? null);
  };

  const handleGenerateClick = () => {
    if (!voiceId) {
      setError("Please select a voice first");
      return;
    }
    if (!usageStats || usageStats.totalRemaining < creditCost) {
      setError(`Not enough credits. You need ${creditCost} credits to generate this video.`);
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmGenerate = async () => {
    setShowConfirm(false);
    setError(null);
    setIsGenerating(true);

    try {
      await generateVideo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start video generation");
      setIsGenerating(false);
    }
  };

  if (status === "completed" && finalVideoUrl) {
    return <VideoPreviewState videoUrl={finalVideoUrl} scenes={scenes} teamId={teamId} />;
  }

  if (status === "generating_video" || isGenerating) {
    return <GeneratingState progress={progress} progressMessage={progressMessage} />;
  }

  if (!selectedScript || scenes.length === 0) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="py-16 text-center">
          <Icon icon="solar:danger-triangle-bold-duotone" className="text-amber-400 mx-auto mb-4" width={48} />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Script Found</h3>
          <p className="text-text-secondary text-sm">
            Please go back and generate a script first
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Generate Your Cloned Ad
        </h2>
        <p className="text-text-secondary">
          Select a voice and create your AI-generated video
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

      <VoiceSelectorInline selectedVoice={selectedVoice} onVoiceChange={handleVoiceChange} />

      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="p-5">
          <h3 className="text-base font-semibold text-text-primary mb-4">Video Summary</h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-surface-base rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Icon icon="solar:document-text-bold-duotone" className="text-orange-500" width={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Script</p>
                <p className="text-xs text-text-secondary">
                  {selectedScript.title} • {scenes.length} scenes
                </p>
              </div>
            </div>

            {selectedVoice && (
              <div className="flex items-center gap-3 p-3 bg-surface-base rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Icon icon="solar:soundwave-bold-duotone" className="text-purple-400" width={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">Voice</p>
                  <p className="text-xs text-text-secondary">
                    {selectedVoice.name} • {selectedVoice.gender}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border border-orange-500/30">
        <CardBody className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/30 flex items-center justify-center">
                <Icon icon="solar:stars-bold-duotone" className="text-orange-500" width={28} />
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary">{creditCost} Credits</p>
                <p className="text-sm text-text-secondary">
                  {scenes.length} scenes • 2 credits per scene
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {usageStats
                    ? `You have ${usageStats.totalRemaining} credits remaining`
                    : "Loading credits..."}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              className="bg-orange-500 text-white font-semibold px-8"
              onPress={handleGenerateClick}
              isDisabled={!voiceId || !usageStats || usageStats.totalRemaining < creditCost}
              startContent={<Icon icon="solar:play-bold" width={20} />}
            >
              Generate Video
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        classNames={{
          base: "bg-surface-elevated border border-border-base",
          header: "border-b border-border-base",
          footer: "border-t border-border-base",
        }}
      >
        <ModalContent>
          <ModalHeader>
            <span className="text-text-primary">Confirm Video Generation</span>
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-4">
              <div className="flex justify-center mb-4">
                <BrandLogo size={64} />
              </div>
              <p className="text-text-primary mb-2">
                This will use <span className="font-bold text-orange-500">{creditCost} credits</span>
              </p>
              <p className="text-xs text-text-muted mb-2">
                {scenes.length} scenes • 2 credits per scene
              </p>
              <p className="text-sm text-text-secondary">
                You&apos;ll have {usageStats ? usageStats.totalRemaining - creditCost : 0} credits remaining
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              className="border-border-base text-text-secondary"
              onPress={() => setShowConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-orange-500 text-white font-semibold"
              onPress={handleConfirmGenerate}
              startContent={<Icon icon="solar:play-bold" width={16} />}
            >
              Generate Video
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
