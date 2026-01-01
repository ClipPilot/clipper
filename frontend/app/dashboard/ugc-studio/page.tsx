"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button, Card, CardBody, CardHeader, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { apiFetch } from "@/lib/apiClient";
import API_URL from "@/config/constants";

type StudioView = "menu" | "face-swap";

interface UploadedFile {
  file: File;
  preview: string;
}

interface TrimResult {
  trimmedVideoKey: string;
  trimmedVideoUrl: string;
  duration: number;
}

// Video Trimmer Component
interface VideoTrimmerProps {
  videoSrc: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  onTrimChange: (start: number, end: number) => void;
  maxDuration?: number;
}

function VideoTrimmer({
  videoSrc,
  duration,
  trimStart,
  trimEnd,
  onTrimChange,
  maxDuration = 30,
}: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState<"start" | "end" | "playhead" | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  // Generate video thumbnails for the timeline
  useEffect(() => {
    if (!videoSrc || duration <= 0) return;

    const generateThumbnails = async () => {
      setIsGeneratingThumbnails(true);
      const video = document.createElement("video");
      video.src = videoSrc;
      video.crossOrigin = "anonymous";
      video.muted = true;

      await new Promise((resolve) => {
        video.onloadeddata = resolve;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Generate ~20 thumbnails or 1 per 2 seconds, whichever is less
      const numThumbnails = Math.min(20, Math.ceil(duration / 2));
      const interval = duration / numThumbnails;
      const thumbs: string[] = [];

      canvas.width = 120;
      canvas.height = 68;

      for (let i = 0; i < numThumbnails; i++) {
        video.currentTime = i * interval;
        await new Promise((resolve) => {
          video.onseeked = resolve;
        });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbs.push(canvas.toDataURL("image/jpeg", 0.5));
      }

      setThumbnails(thumbs);
      setIsGeneratingThumbnails(false);
    };

    generateThumbnails();
  }, [videoSrc, duration]);

  // Sync video time with current time state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Loop within trim range
      if (video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
        if (!isPlaying) {
          video.pause();
        }
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [trimStart, trimEnd, isPlaying]);

  // Set initial video position to trim start
  useEffect(() => {
    if (videoRef.current && !isPlaying) {
      videoRef.current.currentTime = trimStart;
    }
  }, [trimStart]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimelineMouseDown = (
    e: React.MouseEvent,
    type: "start" | "end" | "playhead"
  ) => {
    e.preventDefault();
    setIsDragging(type);
  };

  const handleTimelineMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const time = percentage * duration;

      if (isDragging === "start") {
        const newStart = Math.max(0, Math.min(time, trimEnd - 1));
        // Enforce max duration
        if (trimEnd - newStart > maxDuration) {
          onTrimChange(trimEnd - maxDuration, trimEnd);
        } else {
          onTrimChange(newStart, trimEnd);
        }
      } else if (isDragging === "end") {
        const newEnd = Math.max(trimStart + 1, Math.min(time, duration));
        // Enforce max duration
        if (newEnd - trimStart > maxDuration) {
          onTrimChange(trimStart, trimStart + maxDuration);
        } else {
          onTrimChange(trimStart, newEnd);
        }
      } else if (isDragging === "playhead") {
        const newTime = Math.max(trimStart, Math.min(time, trimEnd));
        if (videoRef.current) {
          videoRef.current.currentTime = newTime;
          setCurrentTime(newTime);
        }
      }
    },
    [isDragging, duration, trimStart, trimEnd, maxDuration, onTrimChange]
  );

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleTimelineMouseMove);
      window.addEventListener("mouseup", handleTimelineMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleTimelineMouseMove);
        window.removeEventListener("mouseup", handleTimelineMouseUp);
      };
    }
  }, [isDragging, handleTimelineMouseMove, handleTimelineMouseUp]);

  const trimStartPercent = (trimStart / duration) * 100;
  const trimEndPercent = (trimEnd / duration) * 100;
  const playheadPercent = (currentTime / duration) * 100;
  const clipDuration = trimEnd - trimStart;

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Play/Pause Overlay */}
        <button
          onClick={togglePlayPause}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors group"
        >
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Icon
              icon={isPlaying ? "solar:pause-bold" : "solar:play-bold"}
              className="text-white text-2xl ml-1"
            />
          </div>
        </button>

        {/* Current Time Display */}
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
          {formatTime(currentTime)}
        </div>

        {/* Duration Display */}
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
          {formatTime(duration)}
        </div>
      </div>

      {/* Timeline Trimmer */}
      <div className="space-y-3">
        {/* Time Markers */}
        <div className="flex justify-between text-xs text-text-tertiary px-1">
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Timeline Container */}
        <div
          ref={timelineRef}
          className="relative h-16 rounded-lg overflow-hidden bg-surface-elevated cursor-pointer select-none"
        >
          {/* Thumbnail Strip */}
          <div className="absolute inset-0 flex">
            {isGeneratingThumbnails ? (
              <div className="flex-1 flex items-center justify-center">
                <Icon
                  icon="solar:refresh-circle-bold-duotone"
                  className="text-2xl text-text-tertiary animate-spin"
                />
              </div>
            ) : thumbnails.length > 0 ? (
              thumbnails.map((thumb, i) => (
                <div
                  key={i}
                  className="flex-1 h-full"
                  style={{
                    backgroundImage: `url(${thumb})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ))
            ) : (
              <div className="flex-1 bg-surface-elevated" />
            )}
          </div>

          {/* Dimmed Areas (outside trim range) */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-black/70"
            style={{ width: `${trimStartPercent}%` }}
          />
          <div
            className="absolute top-0 bottom-0 right-0 bg-black/70"
            style={{ width: `${100 - trimEndPercent}%` }}
          />

          {/* Selected Range Highlight */}
          <div
            className="absolute top-0 bottom-0 border-y-2 border-accent-400"
            style={{
              left: `${trimStartPercent}%`,
              width: `${trimEndPercent - trimStartPercent}%`,
            }}
          />

          {/* Start Handle */}
          <div
            className="absolute top-0 bottom-0 w-4 cursor-ew-resize group z-10"
            style={{ left: `calc(${trimStartPercent}% - 8px)` }}
            onMouseDown={(e) => handleTimelineMouseDown(e, "start")}
          >
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-accent-400 group-hover:w-1.5 transition-all" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 rounded bg-accent-400 flex items-center justify-center">
              <div className="w-0.5 h-4 bg-white/50 rounded-full" />
            </div>
          </div>

          {/* End Handle */}
          <div
            className="absolute top-0 bottom-0 w-4 cursor-ew-resize group z-10"
            style={{ left: `calc(${trimEndPercent}% - 8px)` }}
            onMouseDown={(e) => handleTimelineMouseDown(e, "end")}
          >
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-accent-400 group-hover:w-1.5 transition-all" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 rounded bg-accent-400 flex items-center justify-center">
              <div className="w-0.5 h-4 bg-white/50 rounded-full" />
            </div>
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>

          {/* Click to seek overlay */}
          <div
            className="absolute inset-0 z-5"
            style={{
              left: `${trimStartPercent}%`,
              width: `${trimEndPercent - trimStartPercent}%`,
            }}
            onMouseDown={(e) => handleTimelineMouseDown(e, "playhead")}
          />
        </div>

        {/* Trim Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-text-tertiary">Start:</span>
              <span className="text-text-primary font-mono">{formatTime(trimStart)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-tertiary">End:</span>
              <span className="text-text-primary font-mono">{formatTime(trimEnd)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary text-sm">Duration:</span>
            <span
              className={`font-mono text-sm font-medium ${
                clipDuration > maxDuration ? "text-red-500" : "text-accent-400"
              }`}
            >
              {formatTime(clipDuration)}
            </span>
            <span className="text-text-muted text-xs">/ {maxDuration}s max</span>
          </div>
        </div>

        {clipDuration > maxDuration && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 p-2 rounded-lg">
            <Icon icon="solar:danger-circle-bold" width={16} />
            <span>Clip duration must be {maxDuration} seconds or less</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Example characters from public/characters folder
const EXAMPLE_CHARACTERS = [
  { id: 1, src: "/characters/1.jpg" },
  { id: 2, src: "/characters/2.jpg" },
  { id: 3, src: "/characters/3.jpg" },
  { id: 4, src: "/characters/4.jpg" },
  { id: 5, src: "/characters/5.jpg" },
  { id: 6, src: "/characters/6.jpg" },
  { id: 7, src: "/characters/7.jpg" },
  { id: 8, src: "/characters/8.jpg" },
];

interface SelectedCharacter {
  type: "example" | "uploaded";
  src: string;
  file?: File;
}

export default function UGCStudioPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [currentView, setCurrentView] = useState<StudioView>("face-swap"); // default: menu
  const [video, setVideo] = useState<UploadedFile | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<SelectedCharacter | null>(null);
  // Keep for backwards compatibility with existing logic
  const characterImage = selectedCharacter ? {
    file: selectedCharacter.file || new File([], "example.jpg"),
    preview: selectedCharacter.src
  } : null;
  const [videoDuration, setVideoDuration] = useState(0);
  const [clipRange, setClipRange] = useState<[number, number]>([0, 30]);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [trimResult, setTrimResult] = useState<TrimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (video?.preview) URL.revokeObjectURL(video.preview);
      if (characterImage?.preview) URL.revokeObjectURL(characterImage.preview);
    };
  }, []);

  const handleVideoSelect = useCallback(
    async (file: File) => {
      const validTypes = [
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/x-msvideo",
      ];
      if (!validTypes.includes(file.type)) {
        return;
      }

      // Cleanup old preview
      if (video?.preview) {
        URL.revokeObjectURL(video.preview);
      }

      const preview = URL.createObjectURL(file);
      setVideo({ file, preview });

      // Get video duration
      const videoEl = document.createElement("video");
      videoEl.src = preview;
      videoEl.onloadedmetadata = () => {
        const duration = videoEl.duration;
        setVideoDuration(duration);
        // Set initial clip range (max 30 seconds)
        const maxEnd = Math.min(duration, 30);
        setClipRange([0, maxEnd]);
      };
    },
    [video]
  );

  const handleImageSelect = useCallback(
    (file: File) => {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        return;
      }

      // Cleanup old preview if it was an uploaded file
      if (selectedCharacter?.type === "uploaded" && selectedCharacter.src) {
        URL.revokeObjectURL(selectedCharacter.src);
      }

      const preview = URL.createObjectURL(file);
      setSelectedCharacter({ type: "uploaded", src: preview, file });
    },
    [selectedCharacter]
  );

  const handleExampleSelect = (src: string) => {
    // Cleanup old preview if it was an uploaded file
    if (selectedCharacter?.type === "uploaded" && selectedCharacter.src) {
      URL.revokeObjectURL(selectedCharacter.src);
    }
    setSelectedCharacter({ type: "example", src });
  };

  const handleVideoDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingVideo(false);
      const file = e.dataTransfer.files[0];
      if (file) handleVideoSelect(file);
    },
    [handleVideoSelect]
  );

  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingImage(false);
      const file = e.dataTransfer.files[0];
      if (file) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const handleTrimChange = (start: number, end: number) => {
    setClipRange([start, end]);
  };

  const handleGenerate = async () => {
    if (!video || !characterImage || !selectedTeam?.id) return;

    setError(null);
    setIsProcessing(true);
    setIsUploading(true);
    setTrimResult(null);
    setProcessingStatus("Uploading and trimming video...");

    try {
      // Create FormData with video file and trim parameters
      const formData = new FormData();
      formData.append("video", video.file);
      formData.append("startTime", clipRange[0].toString());
      formData.append("endTime", clipRange[1].toString());
      formData.append("teamId", selectedTeam.id.toString());

      // Upload video directly to backend, which trims it and uploads only the trimmed result to S3
      const trimResponse = await apiFetch(`${API_URL}/face-swap/trim`, {
        method: "POST",
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary for FormData
      });

      if (!trimResponse.ok) {
        const error = await trimResponse.json();
        throw new Error(error.error || "Failed to trim video");
      }

      const result: TrimResult = await trimResponse.json();
      setTrimResult(result);
      setProcessingStatus("Video trimmed successfully!");

      console.log("Trimmed video result:", result);

      // TODO: Next step would be to pass this to face swap API
      // For now, we have the trimmed video ready
    } catch (err) {
      console.error("Generate error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setProcessingStatus("");
    } finally {
      setIsProcessing(false);
      setIsUploading(false);
    }
  };

  const resetFaceSwap = () => {
    if (video?.preview) URL.revokeObjectURL(video.preview);
    if (selectedCharacter?.type === "uploaded" && selectedCharacter.src) {
      URL.revokeObjectURL(selectedCharacter.src);
    }
    setVideo(null);
    setSelectedCharacter(null);
    setVideoDuration(0);
    setClipRange([0, 30]);
    setCurrentView("menu");
    setTrimResult(null);
    setError(null);
    setProcessingStatus("");
  };

  const clipDuration = clipRange[1] - clipRange[0];

  // Main menu view
  if (currentView === "menu") {
    return (
      <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">
              UGC Studio
            </h1>
            <p className="text-text-secondary mt-1">
              Create AI-powered user-generated content
            </p>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Face Swap Card */}
            <Card
              className="bg-surface-base border border-border-base hover:border-accent-400/30 transition-all cursor-pointer group"
              isPressable
              onPress={() => setCurrentView("face-swap")}
            >
              <CardBody className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-accent-400/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon
                      icon="solar:mask-happly-bold-duotone"
                      className="text-accent-400"
                      width={36}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">
                      Face Swap
                    </h3>
                    <p className="text-sm text-text-secondary">
                      Swap faces in your videos with AI-generated characters
                    </p>
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

            {/* Coming Soon Cards */}
            <Card className="bg-surface-base border border-border-base opacity-60">
              <CardBody className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center">
                    <Icon
                      icon="solar:microphone-3-bold-duotone"
                      className="text-text-tertiary"
                      width={36}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-tertiary mb-1">
                      Voice Clone
                    </h3>
                    <p className="text-sm text-text-muted">
                      Clone voices and add custom narration
                    </p>
                  </div>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-surface-elevated text-text-tertiary">
                    Coming Soon
                  </span>
                </div>
              </CardBody>
            </Card>

            <Card className="bg-surface-base border border-border-base opacity-60">
              <CardBody className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center">
                    <Icon
                      icon="solar:gallery-bold-duotone"
                      className="text-text-tertiary"
                      width={36}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-tertiary mb-1">
                      AI Backgrounds
                    </h3>
                    <p className="text-sm text-text-muted">
                      Generate custom backgrounds for your content
                    </p>
                  </div>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-surface-elevated text-text-tertiary">
                    Coming Soon
                  </span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Face Swap View
  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          {/* <Button
            variant="flat"
            isIconOnly
            className="bg-surface-base border border-border-base"
            onPress={resetFaceSwap}
          >
            <Icon icon="solar:arrow-left-bold" width={20} />
          </Button> */}
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Face Swap</h1>
            <p className="text-text-secondary text-sm">
              Upload a video and swap faces with a character
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Upload & Trimmer - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-surface-base border border-border-base">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
                    <Icon
                      icon="solar:videocamera-record-bold-duotone"
                      className="text-accent-400"
                      width={22}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-text-primary">
                      Video & Trim
                    </h3>
                    <p className="text-xs text-text-tertiary">
                      Upload video and select a clip (max 30 seconds)
                    </p>
                  </div>
                  {video && (
                    <Button
                      size="sm"
                      variant="flat"
                      className="bg-surface-elevated text-text-secondary"
                      onPress={() => {
                        if (video.preview) URL.revokeObjectURL(video.preview);
                        setVideo(null);
                        setVideoDuration(0);
                        setClipRange([0, 30]);
                      }}
                      startContent={<Icon icon="solar:refresh-bold" width={16} />}
                    >
                      Change Video
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardBody className="pt-4">
                {video ? (
                  <VideoTrimmer
                    videoSrc={video.preview}
                    duration={videoDuration}
                    trimStart={clipRange[0]}
                    trimEnd={clipRange[1]}
                    onTrimChange={handleTrimChange}
                    maxDuration={30}
                  />
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-xl p-12 transition-colors ${
                      isDraggingVideo
                        ? "border-accent-400 bg-accent-400/10"
                        : "border-border-base hover:border-accent-400/50"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingVideo(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingVideo(false);
                    }}
                    onDrop={handleVideoDrop}
                  >
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-accent-400/10 rounded-full flex items-center justify-center">
                        <Icon
                          icon="solar:upload-bold-duotone"
                          className="text-3xl text-accent-400"
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-medium text-text-primary">
                          Drag & drop your video
                        </p>
                        <p className="text-sm text-text-tertiary mt-1">
                          or click to browse files
                        </p>
                      </div>
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleVideoSelect(file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        size="md"
                        variant="flat"
                        color="primary"
                        onPress={() => videoInputRef.current?.click()}
                        startContent={<Icon icon="solar:folder-open-bold" />}
                      >
                        Browse Files
                      </Button>
                      <p className="text-xs text-text-muted">
                        MP4, MOV, WebM supported
                      </p>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Right Column - Character & Generate */}
          <div className="space-y-6">
            {/* Character Image Upload */}
            <Card className="bg-surface-base border border-border-base">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Icon
                      icon="solar:user-circle-bold-duotone"
                      className="text-purple-500"
                      width={22}
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">
                      Character Face
                    </h3>
                    <p className="text-xs text-text-tertiary">
                      Choose a character or upload your own
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="pt-4 space-y-4">
                {/* Selected Character Display */}
                {selectedCharacter && (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden bg-surface-elevated aspect-square">
                      <img
                        src={selectedCharacter.src}
                        alt="Selected Character"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        className="absolute top-2 right-2 bg-surface-base/80"
                        onPress={() => {
                          if (selectedCharacter.type === "uploaded" && selectedCharacter.src) {
                            URL.revokeObjectURL(selectedCharacter.src);
                          }
                          setSelectedCharacter(null);
                        }}
                      >
                        <Icon icon="solar:close-circle-bold" width={18} />
                      </Button>
                    </div>
                    {selectedCharacter.type === "uploaded" && selectedCharacter.file && (
                      <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
                        <Icon icon="solar:gallery-bold-duotone" width={16} />
                        <span className="truncate">{selectedCharacter.file.name}</span>
                      </div>
                    )}
                    {selectedCharacter.type === "example" && (
                      <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
                        <Icon icon="solar:star-bold-duotone" width={16} />
                        <span>Example Character</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Example Characters Grid */}
                {!selectedCharacter && (
                  <>
                    <div>
                      <p className="text-xs text-text-tertiary mb-2">Choose an example</p>
                      <div className="grid grid-cols-4 gap-2">
                        {EXAMPLE_CHARACTERS.map((char) => (
                          <button
                            key={char.id}
                            onClick={() => handleExampleSelect(char.src)}
                            className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-purple-500 transition-all hover:scale-105 focus:outline-none focus:border-purple-500"
                          >
                            <img
                              src={char.src}
                              alt={`Character ${char.id}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border-base" />
                      <span className="text-xs text-text-muted">or</span>
                      <div className="flex-1 h-px bg-border-base" />
                    </div>

                    {/* Upload Custom */}
                    <div
                      className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
                        isDraggingImage
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-border-base hover:border-purple-500/50"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingImage(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDraggingImage(false);
                      }}
                      onDrop={handleImageDrop}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center">
                          <Icon
                            icon="solar:gallery-add-bold-duotone"
                            className="text-xl text-purple-500"
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-text-primary">
                            Upload your own
                          </p>
                          <p className="text-xs text-text-tertiary">
                            JPG, PNG, WebP
                          </p>
                        </div>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageSelect(file);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          size="sm"
                          variant="flat"
                          className="bg-purple-500/20 text-purple-500"
                          onPress={() => imageInputRef.current?.click()}
                          startContent={<Icon icon="solar:folder-open-bold" />}
                        >
                          Browse
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>

            {/* Generate Button */}
            <Card className="bg-surface-base border border-border-base">
              <CardBody className="p-4">
                {isProcessing ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
                        <Icon
                          icon={isUploading ? "solar:cloud-upload-bold-duotone" : "solar:magic-stick-3-bold-duotone"}
                          className="text-accent-400 animate-pulse"
                          width={22}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {processingStatus || "Processing..."}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {isUploading ? "Uploading to cloud..." : "This may take a moment"}
                        </p>
                      </div>
                    </div>
                    <Progress
                      isIndeterminate
                      color="primary"
                      size="sm"
                      className="w-full"
                    />
                  </div>
                ) : trimResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <Icon
                          icon="solar:check-circle-bold-duotone"
                          className="text-green-500"
                          width={22}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          Video Trimmed Successfully!
                        </p>
                        <p className="text-xs text-text-tertiary">
                          Duration: {trimResult.duration.toFixed(1)}s
                        </p>
                      </div>
                    </div>
                    <video
                      src={trimResult.trimmedVideoUrl}
                      controls
                      className="w-full rounded-lg"
                    />
                    <Button
                      className="w-full bg-accent-400 text-white font-semibold"
                      size="lg"
                      onPress={() => {
                        setTrimResult(null);
                        setProcessingStatus("");
                      }}
                      startContent={<Icon icon="solar:refresh-bold" width={20} />}
                    >
                      Trim Again
                    </Button>
                  </div>
                ) : error ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg">
                      <Icon icon="solar:danger-circle-bold" className="text-red-500" width={20} />
                      <p className="text-sm text-red-500">{error}</p>
                    </div>
                    <Button
                      className="w-full bg-accent-400 text-white font-semibold"
                      size="lg"
                      onPress={() => setError(null)}
                      startContent={<Icon icon="solar:refresh-bold" width={20} />}
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${video ? "bg-green-500" : "bg-surface-elevated"}`}
                        />
                        <span
                          className={`text-sm ${video ? "text-text-primary" : "text-text-tertiary"}`}
                        >
                          Video uploaded
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${characterImage ? "bg-green-500" : "bg-surface-elevated"}`}
                        />
                        <span
                          className={`text-sm ${characterImage ? "text-text-primary" : "text-text-tertiary"}`}
                        >
                          Character uploaded
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${video && clipDuration <= 30 ? "bg-green-500" : "bg-surface-elevated"}`}
                        />
                        <span
                          className={`text-sm ${video && clipDuration <= 30 ? "text-text-primary" : "text-text-tertiary"}`}
                        >
                          Clip selected (≤30s)
                        </span>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-accent-400 text-white font-semibold"
                      size="lg"
                      isDisabled={!video || !characterImage || clipDuration > 30}
                      onPress={handleGenerate}
                      startContent={
                        <Icon icon="solar:magic-stick-3-bold-duotone" width={20} />
                      }
                    >
                      Generate Face Swap
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
