"use client";

import React, { useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Slider, Button, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import { audioStateAtom, BackgroundMusic, editorClipAtom } from "@/store/videoEditor";
import { selectedTeamAtom } from "@/store/auth";
import { clipsAPI } from "@/api/clips";

export function AudioTool() {
  const [audioState, setAudioState] = useAtom(audioStateAtom);
  const clip = useAtomValue(editorClipAtom);
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleVolumeChange = (volume: number) => {
    setAudioState((prev) => ({ ...prev, originalVolume: volume }));
  };

  const handleMuteToggle = (muted: boolean) => {
    setAudioState((prev) => ({ ...prev, originalMuted: muted }));
  };

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["audio/mpeg", "audio/wav", "audio/aac", "audio/mp4"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload an MP3, WAV, or AAC file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      await new Promise<void>((resolve) => {
        audio.onloadedmetadata = () => resolve();
      });

      const music: BackgroundMusic = {
        s3Key: "",
        fileName: file.name,
        url,
        volume: 0.5,
        startTime: 0,
        trimStart: 0,
        trimEnd: audio.duration,
        duration: audio.duration,
      };

      if (!clip || !selectedTeam?.id) {
        URL.revokeObjectURL(url);
        alert("Please save your clip before uploading music");
        return;
      }

      setAudioState((prev) => ({ ...prev, backgroundMusic: music }));

      const { uploadUrl, s3Key } = await clipsAPI.getMusicUploadUrl(
        selectedTeam.id,
        clip.id,
        file.name,
        file.type
      );
      await clipsAPI.uploadMusicToS3(uploadUrl, file, setUploadProgress);
      setAudioState((prev) => ({
        ...prev,
        backgroundMusic: prev.backgroundMusic
          ? { ...prev.backgroundMusic, s3Key }
          : undefined,
      }));
    } catch (error) {
      console.error("Failed to process audio:", error);
      alert("Failed to upload audio file");
      if (audioState.backgroundMusic?.url) {
        URL.revokeObjectURL(audioState.backgroundMusic.url);
      }
      setAudioState((prev) => ({ ...prev, backgroundMusic: undefined }));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveMusic = () => {
    if (audioState.backgroundMusic?.url) {
      URL.revokeObjectURL(audioState.backgroundMusic.url);
    }
    setAudioState((prev) => ({ ...prev, backgroundMusic: undefined }));
  };

  const handleMusicVolumeChange = (volume: number) => {
    setAudioState((prev) => ({
      ...prev,
      backgroundMusic: prev.backgroundMusic
        ? { ...prev.backgroundMusic, volume }
        : undefined,
    }));
  };

  const handleMusicTrimStartChange = (time: number) => {
    setAudioState((prev) => {
      if (!prev.backgroundMusic) return prev;
      const trimEnd = prev.backgroundMusic.trimEnd || prev.backgroundMusic.duration;
      return {
        ...prev,
        backgroundMusic: {
          ...prev.backgroundMusic,
          trimStart: Math.min(time, trimEnd - 1),
        },
      };
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-accent flex items-center gap-2">
          <Icon icon="solar:volume-loud-bold" className="text-accent-400" />
          Audio Settings
        </h3>
        <p className="text-sm text-text-tertiary mt-1">
          Adjust volume and add background music
        </p>
      </div>

      <div className="bg-surface-elevated rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:microphone-bold"
              className="text-text-secondary"
            />
            <span className="text-sm font-medium text-text-accent">
              Original Audio
            </span>
          </div>
          <Switch
 isSelected={!audioState.originalMuted}
 onChange={(val) => handleMuteToggle(!val)}
 />
        </div>

        {!audioState.originalMuted && (
          <div>
            <div className="flex justify-between text-xs text-text-tertiary mb-2">
              <span>Volume</span>
              <span>{Math.round(audioState.originalVolume * 100)}%</span>
            </div>
            <Slider
 value={audioState.originalVolume}
 onChange={(val) => handleVolumeChange(val as number)}
 minValue={0}
 maxValue={1}
 step={0.01}
 />
          </div>
        )}

        {audioState.originalMuted && (
          <p className="text-xs text-yellow-400 flex items-center gap-1">
            <Icon icon="solar:volume-cross-bold" />
            Original audio will be muted
          </p>
        )}
      </div>

      <div className="bg-surface-elevated rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Icon icon="solar:music-notes-bold" className="text-text-secondary" />
          <span className="text-sm font-medium text-text-accent">
            Background Music
          </span>
        </div>

        {audioState.backgroundMusic ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-surface-base rounded-lg p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-accent-400/20 flex items-center justify-center flex-shrink-0">
                  <Icon
                    icon="solar:music-note-2-bold"
                    className="text-accent-400"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-accent truncate">
                    {audioState.backgroundMusic.fileName}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {formatTime(audioState.backgroundMusic.duration)}
                  </p>
                </div>
              </div>
              <Button
 size="sm"
 variant="danger-soft"
 isIconOnly
 onPress={handleRemoveMusic}
 >
                <Icon icon="solar:trash-bin-trash-bold" />
              </Button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-text-tertiary mb-2">
                <span>Music Volume</span>
                <span>
                  {Math.round(audioState.backgroundMusic.volume * 100)}%
                </span>
              </div>
              <Slider
 value={audioState.backgroundMusic.volume}
 onChange={(val) => handleMusicVolumeChange(val as number)}
 minValue={0}
 maxValue={1}
 step={0.01}
 />
            </div>

            <div>
              <div className="flex justify-between text-xs text-text-tertiary mb-2">
                <span>Song Start</span>
                <span>
                  {formatTime(audioState.backgroundMusic.trimStart || 0)} / {formatTime(audioState.backgroundMusic.duration)}
                </span>
              </div>
              <Slider
 value={audioState.backgroundMusic.trimStart || 0}
 onChange={(val) => handleMusicTrimStartChange(val as number)}
 minValue={0}
 maxValue={Math.max(audioState.backgroundMusic.duration - 1, 0)}
 step={1}
 />
            </div>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/aac,audio/mp4"
              className="hidden"
              onChange={handleMusicUpload}
            />
            <Button
 variant="outline"
 className="w-full"
 onPress={() => fileInputRef.current?.click()}
 isPending={uploading}
 >
              {!uploading && <Icon icon="solar:upload-bold" />}
              {uploading ? `Uploading ${uploadProgress}%` : "Upload Music"}
            </Button>
            <p className="text-xs text-text-tertiary mt-2 text-center">
              MP3, WAV, or AAC (max 50MB)
            </p>
          </div>
        )}
      </div>

      <div className="bg-accent-400/10 rounded-lg p-3">
        <p className="text-xs text-accent-400 flex items-start gap-2">
          <Icon
            icon="solar:info-circle-bold"
            className="text-sm mt-0.5 flex-shrink-0"
          />
          <span>
            Background music will be mixed with the original audio. Adjust both
            volumes to get the right balance.
          </span>
        </p>
      </div>
    </div>
  );
}
