"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Tabs,
  Tab,
  Button,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { voicesConfig, type Voice } from "@/config/voicesConfig";
import { VoiceCard } from "./VoiceCard";

type GenderFilter = "all" | "male" | "female";

interface VoiceSelectorProps {
  selectedVoice: Voice | null;
  onVoiceChange: (voice: Voice | null) => void;
  faceSwap?: boolean;
}

export function VoiceSelector({
  selectedVoice,
  onVoiceChange,
  faceSwap,
}: VoiceSelectorProps) {
  const [filter, setFilter] = useState<GenderFilter>("all");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const {
    isOpen: isSidebarOpen,
    onOpen: openSidebar,
    onClose: closeSidebar,
  } = useDisclosure();
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle animation state when sidebar opens
  useEffect(() => {
    if (isSidebarOpen) {
      // Small delay to trigger the animation after mount
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
    }, 300); // Match the duration-300 transition
  }, [closeSidebar]);

  const filteredVoices =
    filter === "all"
      ? voicesConfig
      : voicesConfig.filter((v) => v.gender === filter);

  const handlePlayToggle = useCallback(
    (voice: Voice) => {
      if (playingVoiceId === voice.id) {
        audioRef.current?.pause();
        setPlayingVoiceId(null);
        setPlaybackProgress(0);
        return;
      }

      if (audioRef.current) {
        // Stop any currently playing audio first
        audioRef.current.pause();
        audioRef.current.currentTime = 0;

        audioRef.current.src = voice.previewFile;
        audioRef.current.load(); // Ensure the new source is loaded

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
    const handleError = (e: Event) => {
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

  const voiceListContent = (
    <>
      <Tabs
        selectedKey={filter}
        onSelectionChange={(key) => setFilter(key as GenderFilter)}
        size="sm"
        variant="light"
        classNames={{
          tabList: "gap-2",
          tab: "px-3",
          cursor: "bg-accent-400/20",
        }}
      >
        <Tab key="all" title="All" />
        <Tab key="male" title="Male" />
        <Tab key="female" title="Female" />
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
          variant="bordered"
          className="w-full justify-between border-border-base bg-surface-elevated h-12"
          onPress={openSidebar}
          startContent={
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-400/20 flex items-center justify-center">
                <Icon
                  icon="solar:microphone-3-bold-duotone"
                  className="text-accent-400"
                  width={18}
                />
              </div>
              <span className="text-text-primary">
                {selectedVoice ? selectedVoice.name : "Select Voice (Optional)"}
              </span>
            </div>
          }
          endContent={
            <Icon
              icon="solar:alt-arrow-right-linear"
              className="text-text-muted"
              width={18}
            />
          }
        />

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
                    <h3 className="text-base font-semibold text-text-primary">
                      Select Voice
                    </h3>
                    <p className="text-xs text-text-tertiary">
                      Choose the AI voice
                    </p>
                  </div>
                </div>
                <Button
                  isIconOnly
                  variant="light"
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

              {/* Voice List */}
              <div className="flex-1 overflow-y-auto p-4">
                {voiceListContent}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardHeader className="pb-0 flex-col items-start gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
            <Icon
              icon="solar:microphone-3-bold-duotone"
              className="text-accent-400"
              width={22}
            />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Select Voice
            </h3>
            <p className="text-xs text-text-tertiary">
              Choose the AI voice for your video
            </p>
          </div>
        </div>
        <Tabs
          selectedKey={filter}
          onSelectionChange={(key) => setFilter(key as GenderFilter)}
          size="sm"
          variant="light"
          classNames={{
            tabList: "gap-2",
            tab: "px-3",
            cursor: "bg-accent-400/20",
          }}
        >
          <Tab key="all" title="All" />
          <Tab key="male" title="Male" />
          <Tab key="female" title="Female" />
        </Tabs>
      </CardHeader>
      <CardBody className="pt-4">
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
            />
          ))}
        </div>
        <audio ref={audioRef} className="hidden" preload="none" />
      </CardBody>
    </Card>
  );
}
