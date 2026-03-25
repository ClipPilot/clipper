"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Card,
  Tabs,
  Button,
  useOverlayState } from "@heroui/react";
import { Icon } from "@iconify/react";
import { voicesConfig, type Voice } from "@/config/voicesConfig";
import { VoiceCard } from "./VoiceCard";
import { VoiceCloneModal } from "./VoiceCloneModal";
import { voiceCloneAPI, type ClonedVoice } from "@/api/voiceClone";

type GenderFilter = "all" | "male" | "female";

interface VoiceSelectorProps {
  selectedVoice: Voice | null;
  onVoiceChange: (voice: Voice | null) => void;
  faceSwap?: boolean;
  teamId?: number;
}

function clonedToVoice(cv: ClonedVoice): Voice {
  return {
    id: cv.voiceId,
    name: cv.name,
    previewFile: cv.previewUrl,
    gender: cv.gender,
    description: "Your cloned voice",
    isCloned: true,
    clonedVoiceDbId: cv.id,
  };
}

export function VoiceSelector({
  selectedVoice,
  onVoiceChange,
  faceSwap,
  teamId,
}: VoiceSelectorProps) {
  const [filter, setFilter] = useState<GenderFilter>("all");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const {
    isOpen: isSidebarOpen,
    onOpen: openSidebar,
    onClose: closeSidebar,
  } = useOverlayState();
  const {
    isOpen: isCloneModalOpen,
    onOpen: openCloneModal,
    onClose: closeCloneModal,
  } = useOverlayState();
  const [isAnimating, setIsAnimating] = useState(false);
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([]);

  // Fetch cloned voices on mount
  useEffect(() => {
    if (!teamId) return;
    voiceCloneAPI
      .listClonedVoices(teamId)
      .then((res) => setClonedVoices(res.voices.map(clonedToVoice)))
      .catch((err) => console.error("[VoiceSelector] Failed to load cloned voices:", err));
  }, [teamId]);

  const refreshClonedVoices = useCallback(() => {
    if (!teamId) return;
    voiceCloneAPI
      .listClonedVoices(teamId)
      .then((res) => setClonedVoices(res.voices.map(clonedToVoice)))
      .catch((err) => console.error("[VoiceSelector] Refresh failed:", err));
  }, [teamId]);

  const handleDeleteClonedVoice = useCallback(async (voice: Voice) => {
    if (!voice.clonedVoiceDbId) return;
    try {
      await voiceCloneAPI.deleteClonedVoice(voice.clonedVoiceDbId);
      setClonedVoices((prev) => prev.filter((v) => v.id !== voice.id));
      if (selectedVoice?.id === voice.id) onVoiceChange(null);
    } catch (err) {
      console.error("[VoiceSelector] Delete failed:", err);
    }
  }, [selectedVoice, onVoiceChange]);

  // Handle animation state when sidebar opens
  useEffect(() => {
    if (isSidebarOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    }
  }, [isSidebarOpen]);

  // Animated close handler
  const handleCloseSidebar = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      closeSidebar();
    }, 300);
  }, [closeSidebar]);

  const allVoices = [...clonedVoices, ...voicesConfig];
  const filteredVoices =
    filter === "all"
      ? allVoices
      : allVoices.filter((v) => v.gender === filter);

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
            console.error("[VoiceSelector] Audio playback failed:", err);
            setPlayingVoiceId(null);
          });
      }
    },
    [playingVoiceId],
  );

  const handleSelect = useCallback(
    (voice: Voice) => {
      onVoiceChange(selectedVoice?.id === voice.id ? null : voice);
    },
    [selectedVoice, onVoiceChange],
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
    const handleError = () => {
      console.error("[VoiceSelector] Audio error:", audio.error);
      setPlayingVoiceId(null);
      setPlaybackProgress(0);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  const cloneButton = teamId ? (
    <Button
 size="sm"
 className="bg-purple-500 text-white"
 onPress={openCloneModal}
 >
      <Icon icon="solar:microphone-3-bold" width={16} />
      Clone Your Voice
    </Button>
  ) : null;

  const cloneModal = teamId ? (
    <VoiceCloneModal
      isOpen={isCloneModalOpen}
      onClose={closeCloneModal}
      teamId={teamId}
      onSuccess={refreshClonedVoices}
    />
  ) : null;

  const voiceListContent = (
    <>
      <Tabs
 selectedKey={filter}
 onSelectionChange={(key) => setFilter(key as GenderFilter)}
 >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Voice gender filter">
            <Tabs.Tab id="all">
              All
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="male">
              Male
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="female">
              Female
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <div
        className={
          faceSwap ? "flex flex-col gap-2 mt-4" : "grid grid-cols-2 gap-2 mt-4"
        }
      >
        {filteredVoices.map((voice) => (
          <VoiceCard
            key={voice.id}
            voice={voice}
            isSelected={selectedVoice?.id === voice.id}
            isPlaying={playingVoiceId === voice.id}
            progress={playingVoiceId === voice.id ? playbackProgress : 0}
            onSelect={() => {
              handleSelect(voice);
              if (faceSwap) handleCloseSidebar();
            }}
            onPlayToggle={() => handlePlayToggle(voice)}
            onDelete={voice.isCloned ? () => handleDeleteClonedVoice(voice) : undefined}
          />
        ))}
      </div>
      <audio ref={audioRef} className="hidden" preload="none" />
    </>
  );

  if (faceSwap) {
    return (
      <>
        <Button
 variant="outline"
 className="w-full justify-between border-border-base bg-surface-elevated h-12"
 onPress={openSidebar}>
          <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-400/20 flex items-center justify-center">
                <Icon
                  icon="solar:microphone-3-bold-duotone"
                  className="text-accent-400"
                  width={18}
                />
              </div>
              <span className="text-text-accent">
                {selectedVoice ? selectedVoice.name : "Select Voice (Optional)"}
              </span>
            </div>
          <Icon
              icon="solar:alt-arrow-right-linear"
              className="text-text-muted"
              width={18}
            />
        </Button>

        {/* Sidebar Overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
              className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
                isAnimating ? "opacity-100" : "opacity-0"
              }`}
              onClick={handleCloseSidebar}
            />

            {/* Sidebar Panel */}
            <div
              className={`relative w-80 max-w-full h-full bg-surface-base border-l border-border-base shadow-xl flex flex-col transition-transform duration-300 ease-out ${
                isAnimating ? "translate-x-0" : "translate-x-full"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border-base">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
                    <Icon
                      icon="solar:microphone-3-bold-duotone"
                      className="text-accent-400"
                      width={22}
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-accent">
                      Select Voice
                    </h3>
                    <p className="text-xs text-text-tertiary">
                      Choose the AI voice
                    </p>
                  </div>
                </div>
                <Button
 isIconOnly
 variant="tertiary"
 size="sm"
 onPress={handleCloseSidebar}
 >
                  <Icon
                    icon="solar:close-circle-bold"
                    className="text-text-muted"
                    width={20}
                  />
                </Button>
              </div>

              {/* Clone button in sidebar */}
              {cloneButton && (
                <div className="px-4 pt-4">
                  {cloneButton}
                </div>
              )}

              {/* Voice List */}
              <div className="flex-1 overflow-y-auto p-4">
                {voiceListContent}
              </div>
            </div>
          </div>
        )}

        {cloneModal}
      </>
    );
  }

  return (
    <>
      <Card className="bg-surface-base border border-border-base">
        <Card.Header className="pb-0 flex-col items-start gap-3">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
              <Icon
                icon="solar:microphone-3-bold-duotone"
                className="text-accent-400"
                width={22}
              />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-text-accent">
                Select Voice
              </h3>
              <p className="text-xs text-text-tertiary">
                Choose the AI voice for your video
              </p>
            </div>
            {cloneButton}
          </div>
          <Tabs
 selectedKey={filter}
 onSelectionChange={(key) => setFilter(key as GenderFilter)}
 >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Voice gender filter">
                <Tabs.Tab id="all">
                  All
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="male">
                  Male
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="female">
                  Female
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </Card.Header>
        <Card.Content className="pt-4">
          <div className="grid grid-cols-2 gap-2">
            {filteredVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                isSelected={selectedVoice?.id === voice.id}
                isPlaying={playingVoiceId === voice.id}
                progress={playingVoiceId === voice.id ? playbackProgress : 0}
                onSelect={() => handleSelect(voice)}
                onPlayToggle={() => handlePlayToggle(voice)}
                onDelete={voice.isCloned ? () => handleDeleteClonedVoice(voice) : undefined}
              />
            ))}
          </div>
          <audio ref={audioRef} className="hidden" preload="none" />
        </Card.Content>
      </Card>

      {cloneModal}
    </>
  );
}
