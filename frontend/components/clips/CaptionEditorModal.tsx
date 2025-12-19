"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Clip, CaptionEntry, clipsAPI } from "@/api/clips";

interface CaptionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: Clip;
  teamId: number;
  onUpdate: (updatedClip: Partial<Clip>) => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, "0")}`;
};

export default function CaptionEditorModal({
  isOpen,
  onClose,
  clip,
  teamId,
  onUpdate,
}: CaptionEditorModalProps) {
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (clip.captions_data) {
      setCaptions(JSON.parse(JSON.stringify(clip.captions_data)));
    }
  }, [clip.captions_data]);

  const handleCaptionTextChange = (index: number, text: string) => {
    setCaptions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, text } : c))
    );
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleJumpToCaption = (startTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play();
    }
  };

  const isActiveCaption = (caption: CaptionEntry): boolean => {
    return currentTime >= caption.startTime && currentTime < caption.endTime;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const metadata = clip.clip_metadata as any;
      const captionColor = metadata?.parameters?.captionColor;
      const result = await clipsAPI.updateCaptions(teamId, clip.id, captions, captionColor);
      onUpdate({
        clipUrl: result.clipUrl,
        captions_data: result.captionsData,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save captions:", error);
    } finally {
      setSaving(false);
    }
  };

  const blankVideoUrl = clip.blankVideoUrl || clip.clipUrl;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      classNames={{
        base: "bg-surface-base border border-border-base max-h-[90vh]",
        header: "border-b border-border-base",
        body: "p-0",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-text-primary">Edit Captions</h2>
          <p className="text-sm text-text-secondary">
            Edit caption text for each timestamp
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="flex h-[60vh]">
            <div className="w-1/2 flex flex-col items-center justify-center p-4 border-r border-border-base">
              {blankVideoUrl ? (
                <div className="rounded-lg overflow-hidden bg-black w-full max-w-sm">
                  <video
                    ref={videoRef}
                    src={blankVideoUrl}
                    controls
                    className="w-full max-h-[50vh] object-contain"
                    crossOrigin="anonymous"
                    onTimeUpdate={handleTimeUpdate}
                  />
                </div>
              ) : (
                <div className="rounded-lg bg-surface-elevated w-full h-64 flex items-center justify-center">
                  <div className="text-center">
                    <Icon
                      icon="solar:video-frame-play-vertical-bold-duotone"
                      className="text-6xl text-text-tertiary mb-2"
                    />
                    <p className="text-text-secondary">Video not available</p>
                  </div>
                </div>
              )}
              <p className="mt-2 text-sm text-text-tertiary">
                Current: {formatTime(currentTime)}
              </p>
            </div>

            <div className="w-1/2 flex flex-col h-full">
              <div className="flex items-center justify-between p-4 pb-2">
                <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                  <Icon icon="solar:subtitles-bold" className="text-accent-400" />
                  Captions ({captions.length})
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 px-4 pb-4">
                {captions.map((caption, index) => (
                  <div
                    key={caption.index}
                    className={`p-3 rounded-lg border transition-all ${
                      isActiveCaption(caption)
                        ? "bg-accent-400/10 border-accent-400"
                        : "bg-surface-elevated border-border-base hover:border-border-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => handleJumpToCaption(caption.startTime)}
                        className="flex items-center gap-2 text-xs text-text-tertiary hover:text-accent-400 transition-colors"
                      >
                        <Icon icon="solar:play-circle-outline" className="text-base" />
                        {formatTime(caption.startTime)} - {formatTime(caption.endTime)}
                      </button>
                      <span className="text-xs text-text-tertiary">#{caption.index}</span>
                    </div>
                    <Input
                      value={caption.text}
                      onChange={(e) => handleCaptionTextChange(index, e.target.value)}
                      variant="bordered"
                      size="sm"
                      classNames={{
                        input: "text-sm",
                        inputWrapper: "bg-surface-base border-border-base",
                      }}
                    />
                  </div>
                ))}

                {captions.length === 0 && (
                  <div className="text-center py-12">
                    <Icon
                      icon="solar:subtitles-outline"
                      className="text-4xl text-text-tertiary mb-2 mx-auto"
                    />
                    <p className="text-text-secondary">No captions available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex justify-between">
          <Button variant="flat" onPress={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isDisabled={saving || captions.length === 0}
            startContent={
              saving ? (
                <Spinner size="sm" color="white" />
              ) : (
                <Icon icon="solar:diskette-bold" />
              )
            }
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
