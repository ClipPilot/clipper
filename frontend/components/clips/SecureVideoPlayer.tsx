"use client";

import React, { useRef, useState } from "react";
import { Icon } from "@iconify/react";

interface SecureVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

export const SecureVideoPlayer: React.FC<SecureVideoPlayerProps> = ({
  src,
  poster,
  className = "",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      videoRef.current.currentTime = percentage * duration;
    }
  };

  return (
    <div
      className={`relative bg-black rounded-lg overflow-hidden group ${className}`}
      onContextMenu={handleContextMenu}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
      />

      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={togglePlay}
          className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
        >
          <Icon
            icon={isPlaying ? "solar:pause-bold" : "solar:play-bold"}
            className="text-3xl text-black ml-1"
          />
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div
          className="w-full h-1 bg-white/30 rounded-full cursor-pointer mb-2"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-accent-400 rounded-full transition-all"
            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-white text-xs">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
        <Icon icon="solar:eye-bold" className="text-sm" />
        <span>Preview</span>
      </div>
    </div>
  );
};
