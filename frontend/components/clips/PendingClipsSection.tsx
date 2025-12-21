"use client";

import React, { useRef, useEffect, useState } from "react";
import { Card, CardBody, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Clip {
  id: number;
  status: string;
  created_at: string;
  rawVideoUrl?: string;
}

interface PendingClipsSectionProps {
  clips: Clip[];
  onClipClick: (clip: Clip) => void;
}

function VideoThumbnail({ videoUrl }: { videoUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 1; // Seek to 1 second for thumbnail
    }
  }, [videoUrl]);

  return (
    <div className="relative w-full aspect-[9/16] bg-surface-elevated rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        src={videoUrl}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setIsLoaded(true)}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-warning-400/30 border-t-warning-400 rounded-full animate-spin" />
        </div>
      )}
      {/* Processing overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 flex flex-col items-center justify-center">
        {/* Animated processing indicator */}
        <div className="relative mb-4">
          {/* Outer ring */}
          <div className="w-16 h-16 rounded-full border-4 border-warning-500/20 animate-pulse" />
          {/* Spinning ring */}
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-warning-400 animate-spin" />
          {/* Inner icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon
              icon="solar:video-frame-play-horizontal-bold"
              className="text-2xl text-warning-400"
            />
          </div>
        </div>
        <span className="text-sm font-medium text-white">Processing</span>
        {/* Animated progress bar */}
        <div className="w-24 mt-2">
          <Progress
            size="sm"
            isIndeterminate
            color="warning"
            classNames={{
              track: "bg-white/20",
              indicator: "bg-gradient-to-r from-warning-400 to-warning-500",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PlaceholderThumbnail() {
  return (
    <div className="relative w-full aspect-[9/16] bg-gradient-to-br from-surface-elevated to-surface-base rounded-lg overflow-hidden">
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      {/* Processing overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Animated processing indicator */}
        <div className="relative mb-4">
          {/* Outer ring */}
          <div className="w-16 h-16 rounded-full border-4 border-warning-500/20 animate-pulse" />
          {/* Spinning ring */}
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-warning-400 animate-spin" />
          {/* Inner icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon
              icon="solar:video-frame-play-horizontal-bold"
              className="text-2xl text-warning-400"
            />
          </div>
        </div>
        <span className="text-sm font-medium text-text-primary">Processing</span>
        {/* Animated progress bar */}
        <div className="w-24 mt-2">
          <Progress
            size="sm"
            isIndeterminate
            color="warning"
            classNames={{
              track: "bg-surface-base",
              indicator: "bg-gradient-to-r from-warning-400 to-warning-500",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function PendingClipsSection({
  clips,
  onClipClick,
}: PendingClipsSectionProps) {
  if (clips.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
        <Icon
          icon="solar:clock-circle-bold-duotone"
          className="text-2xl text-warning-400"
        />
        Processing ({clips.length})
      </h2>
      <p className="text-sm text-text-tertiary mb-4">
        Processing may take anywhere from 5 to 30 minutes; we&apos;ll email you when
        it&apos;s complete.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {clips.map((clip) => (
          <Card
            key={clip.id}
            isPressable
            onPress={() => onClipClick(clip)}
            className="bg-surface-base border border-warning-500/30 hover:border-warning-500/50 hover:scale-[1.02] transition-all duration-200"
          >
            <CardBody className="p-2">
              {clip.rawVideoUrl ? (
                <VideoThumbnail videoUrl={clip.rawVideoUrl} />
              ) : (
                <PlaceholderThumbnail />
              )}
              <div className="mt-2 text-center">
                <p className="text-xs text-text-tertiary">
                  Started {new Date(clip.created_at).toLocaleTimeString()}
                </p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
