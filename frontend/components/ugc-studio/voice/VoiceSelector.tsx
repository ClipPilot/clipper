"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Card, CardBody, CardHeader, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { voicesConfig, type Voice } from "@/config/voicesConfig";
import { VoiceCard } from "./VoiceCard";

type GenderFilter = "all" | "male" | "female";

interface VoiceSelectorProps {
  selectedVoice: Voice | null;
  onVoiceChange: (voice: Voice | null) => void;
}

export function VoiceSelector({ selectedVoice, onVoiceChange }: VoiceSelectorProps) {
  const [filter, setFilter] = useState<GenderFilter>("all");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const filteredVoices =
    filter === "all" ? voicesConfig : voicesConfig.filter((v) => v.gender === filter);

  const handlePlayToggle = useCallback((voice: Voice) => {
    if (playingVoiceId === voice.id) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      setPlaybackProgress(0);
      return;
    }

    if (audioRef.current) {
      audioRef.current.src = voice.previewFile;
      audioRef.current.play().catch(() => {});
      setPlayingVoiceId(voice.id);
      setPlaybackProgress(0);
    }
  }, [playingVoiceId]);

  const handleSelect = useCallback((voice: Voice) => {
    onVoiceChange(selectedVoice?.id === voice.id ? null : voice);
  }, [selectedVoice, onVoiceChange]);

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
          <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
            <Icon icon="solar:microphone-3-bold-duotone" className="text-accent-400" width={22} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Select Voice</h3>
            <p className="text-xs text-text-tertiary">Choose the AI voice for your video</p>
          </div>
        </div>
        <Tabs
          selectedKey={filter}
          onSelectionChange={(key) => setFilter(key as GenderFilter)}
          size="sm"
          variant="light"
          classNames={{ tabList: "gap-2", tab: "px-3", cursor: "bg-accent-400/20" }}
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
        <audio ref={audioRef} className="hidden" />
      </CardBody>
    </Card>
  );
}
