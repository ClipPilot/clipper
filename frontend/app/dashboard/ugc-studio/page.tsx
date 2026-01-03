"use client";

import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Progress,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Pagination,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { apiFetch } from "@/lib/apiClient";
import API_URL from "@/config/constants";
import { connectSocket, joinTeam, leaveTeam, getSocket } from "@/lib/socket";

type StudioView = "menu" | "face-swap";

interface UploadedFile {
  file: File;
  preview: string;
}

interface FaceSwapJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number | null;
  progressMessage: string | null;
  outputUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
}

const JOBS_PER_PAGE = 6;

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
  const [isDragging, setIsDragging] = useState<
    "start" | "end" | "segment" | "playhead" | null
  >(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTrimStart, setDragStartTrimStart] = useState(0);
  const [dragStartTrimEnd, setDragStartTrimEnd] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
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
    type: "start" | "end" | "segment" | "playhead"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(type);
    setDragStartX(e.clientX);
    setDragStartTrimStart(trimStart);
    setDragStartTrimEnd(trimEnd);
  };

  const handleTimelineMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();

      if (isDragging === "segment") {
        const deltaX = e.clientX - dragStartX;
        const deltaTime = (deltaX / rect.width) * duration;
        const segmentDuration = dragStartTrimEnd - dragStartTrimStart;

        let newStart = dragStartTrimStart + deltaTime;
        let newEnd = dragStartTrimEnd + deltaTime;

        if (newStart < 0) {
          newStart = 0;
          newEnd = segmentDuration;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - segmentDuration;
        }

        onTrimChange(newStart, newEnd);
      } else {
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const time = percentage * duration;

        if (isDragging === "start") {
          const newStart = Math.max(0, Math.min(time, trimEnd - 1));
          if (trimEnd - newStart > maxDuration) {
            onTrimChange(trimEnd - maxDuration, trimEnd);
          } else {
            onTrimChange(newStart, trimEnd);
          }
        } else if (isDragging === "end") {
          const newEnd = Math.max(trimStart + 1, Math.min(time, duration));
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
      }
    },
    [
      isDragging,
      duration,
      trimStart,
      trimEnd,
      maxDuration,
      onTrimChange,
      dragStartX,
      dragStartTrimStart,
      dragStartTrimEnd,
    ]
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
  const clipDuration = Math.round((trimEnd - trimStart) * 100) / 100;
  const exceedsMax = clipDuration > maxDuration + 0.01;

  return (
    <div className="space-y-4">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
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
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
          {formatTime(currentTime)}
        </div>
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
          {formatTime(duration)}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-xs text-text-tertiary px-1">
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div
          ref={timelineRef}
          className="relative h-16 rounded-lg overflow-hidden bg-surface-elevated cursor-pointer select-none"
        >
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

          <div
            className="absolute top-0 bottom-0 left-0 bg-black/70"
            style={{ width: `${trimStartPercent}%` }}
          />
          <div
            className="absolute top-0 bottom-0 right-0 bg-black/70"
            style={{ width: `${100 - trimEndPercent}%` }}
          />

          <div
            className="absolute top-0 bottom-0 border-y-2 border-accent-400 cursor-grab active:cursor-grabbing"
            style={{
              left: `${trimStartPercent}%`,
              width: `${trimEndPercent - trimStartPercent}%`,
            }}
            onMouseDown={(e) => handleTimelineMouseDown(e, "segment")}
          />

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

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-text-tertiary">Start:</span>
              <span className="text-text-primary font-mono">
                {formatTime(trimStart)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-tertiary">End:</span>
              <span className="text-text-primary font-mono">
                {formatTime(trimEnd)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary text-sm">Duration:</span>
            <span
              className={`font-mono text-sm font-medium ${
                exceedsMax ? "text-red-500" : "text-accent-400"
              }`}
            >
              {formatTime(clipDuration)}
            </span>
            <span className="text-text-muted text-xs">
              / {maxDuration}s max
            </span>
          </div>
        </div>

        {exceedsMax && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 p-2 rounded-lg">
            <Icon icon="solar:danger-circle-bold" width={16} />
            <span>Clip duration must be {maxDuration} seconds or less</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusColor(status: FaceSwapJob["status"]) {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "running":
      return "primary";
    default:
      return "default";
  }
}

function getStatusIcon(status: FaceSwapJob["status"]) {
  switch (status) {
    case "completed":
      return "solar:check-circle-bold";
    case "failed":
      return "solar:close-circle-bold";
    case "running":
      return "solar:refresh-circle-bold-duotone";
    default:
      return "solar:clock-circle-bold";
  }
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "In progress";
  const duration = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
  if (duration < 60) return `${Math.round(duration)}s`;
  return `${Math.floor(duration / 60)}m ${Math.round(duration % 60)}s`;
}

function FaceSwapDetailModal({
  job,
  isOpen,
  onClose,
}: {
  job: FaceSwapJob | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!job?.outputUrl || isDownloading) return;

    setIsDownloading(true);
    try {
      const response = await fetch(job.outputUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `face-swap-${job.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Failed to download video:", error);
      addToast({
        title: "Download failed",
        description: "Failed to download the video. Please try again.",
        color: "danger",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!job) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      classNames={{
        base: "bg-surface-base border border-border-base",
        header: "border-b border-border-base",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <Icon
            icon="solar:mask-happly-bold-duotone"
            className="text-accent-400"
            width={24}
          />
          <span>Face Swap Details</span>
        </ModalHeader>
        <ModalBody className="py-6">
          <div className="space-y-6">
            {job.status === "completed" && job.outputUrl ? (
              <div className="rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  src={job.outputUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
              </div>
            ) : (
              <div className="rounded-xl bg-surface-elevated aspect-video flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Icon
                    icon={getStatusIcon(job.status)}
                    className={`text-5xl ${job.status === "running" ? "animate-spin text-accent-400" : "text-text-tertiary"}`}
                  />
                  {job.status === "running" && (
                    <div className="space-y-2 px-8">
                      <Progress
                        value={job.progress || 0}
                        size="md"
                        color="primary"
                        className="max-w-xs mx-auto"
                      />
                      <p className="text-sm text-text-secondary">
                        {job.progressMessage || "Processing..."}
                      </p>
                    </div>
                  )}
                  {job.status === "failed" && (
                    <p className="text-sm text-red-500 px-4">
                      {job.errorMessage || "Processing failed"}
                    </p>
                  )}
                  {job.status === "queued" && (
                    <p className="text-sm text-text-secondary">Queuing Job.</p>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Status</p>
                <Chip
                  size="sm"
                  color={getStatusColor(job.status)}
                  variant="flat"
                >
                  {job.status}
                </Chip>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Created</p>
                <p className="text-sm text-text-primary">
                  {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Processing Time</p>
                <p className="text-sm text-text-primary">
                  {formatDuration(job.createdAt, job.finishedAt)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-tertiary">Job ID</p>
                <p className="text-sm text-text-primary font-mono truncate">
                  {job.id}
                </p>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Close
          </Button>
          {job.status === "completed" && job.outputUrl && (
            <Button
              color="primary"
              onPress={handleDownload}
              isLoading={isDownloading}
              startContent={
                !isDownloading && <Icon icon="solar:download-bold" width={18} />
              }
            >
              {isDownloading ? "Downloading..." : "Download Video"}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

const FaceSwapJobCard = memo(
  function FaceSwapJobCard({
    job,
    onClick,
  }: {
    job: FaceSwapJob;
    onClick: () => void;
  }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!job.outputUrl || isDownloading) return;

      setIsDownloading(true);
      try {
        const response = await fetch(job.outputUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `face-swap-${job.id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error("Failed to download video:", error);
        addToast({
          title: "Download failed",
          description: "Failed to download the video. Please try again.",
          color: "danger",
        });
      } finally {
        setIsDownloading(false);
      }
    };

    return (
      <Card
        className="bg-surface-base border border-border-base hover:border-accent-400/30 transition-colors cursor-pointer"
        isPressable
        onPress={onClick}
      >
        <CardBody className="p-4">
          <div className="flex gap-4">
            <div className="w-32 h-20 rounded-lg bg-surface-elevated overflow-hidden flex-shrink-0">
              {job.status === "completed" && job.outputUrl ? (
                <video
                  ref={videoRef}
                  src={job.outputUrl}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  onMouseEnter={() => videoRef.current?.play()}
                  onMouseLeave={() => {
                    if (videoRef.current) {
                      videoRef.current.pause();
                      videoRef.current.currentTime = 0;
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon
                    icon={getStatusIcon(job.status)}
                    className={`text-2xl ${job.status === "running" ? "animate-spin text-accent-400" : "text-text-tertiary"}`}
                  />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Chip
                    size="sm"
                    color={getStatusColor(job.status)}
                    variant="flat"
                  >
                    {job.status}
                  </Chip>
                  <span className="text-xs text-text-tertiary">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {job.status === "completed" && job.outputUrl && (
                  <Button
                    size="sm"
                    variant="flat"
                    isIconOnly
                    className="bg-accent-400/20 text-accent-400 min-w-8 w-8 h-8"
                    onPress={handleDownload as any}
                    isLoading={isDownloading}
                  >
                    {!isDownloading && (
                      <Icon icon="solar:download-bold" width={16} />
                    )}
                  </Button>
                )}
              </div>
              {job.status === "running" && (
                <div className="space-y-1">
                  <Progress
                    value={job.progress || 0}
                    size="sm"
                    color="primary"
                  />
                  <p className="text-xs text-text-tertiary">
                    {job.progressMessage || "Processing..."}
                  </p>
                </div>
              )}
              {job.status === "failed" && (
                <p className="text-xs text-red-500 truncate">
                  {job.errorMessage || "Processing failed"}
                </p>
              )}
              {job.status === "completed" && (
                <p className="text-xs text-text-secondary">Click to view</p>
              )}
              {job.status === "queued" && (
                <p className="text-xs text-text-tertiary">Queuing Job.</p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    );
  },
  (prev, next) =>
    prev.job.id === next.job.id &&
    prev.job.status === next.job.status &&
    prev.job.progress === next.job.progress &&
    prev.job.outputUrl === next.job.outputUrl
);

function MyFaceSwapsSection({
  teamId,
  refreshTrigger,
}: {
  teamId: number;
  refreshTrigger?: number;
}) {
  const [jobs, setJobs] = useState<FaceSwapJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<FaceSwapJob | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_URL}/comfy/team/${teamId}/jobs`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchJobs();

    const socket = connectSocket();
    joinTeam(teamId);

    const handleJobUpdate = (update: FaceSwapJob) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === update.id);
        if (idx === -1) {
          return [update, ...prev];
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...update };
        return updated;
      });
    };

    socket.on("comfy-job-update", handleJobUpdate);

    return () => {
      socket.off("comfy-job-update", handleJobUpdate);
      leaveTeam(teamId);
    };
  }, [teamId, fetchJobs]);

  useEffect(() => {
    if (refreshTrigger) fetchJobs();
  }, [refreshTrigger, fetchJobs]);

  useEffect(() => {
    if (selectedJob && isModalOpen) {
      const updated = jobs.find((j) => j.id === selectedJob.id);
      if (
        updated &&
        (updated.status !== selectedJob.status ||
          updated.progress !== selectedJob.progress ||
          updated.outputUrl !== selectedJob.outputUrl)
      ) {
        setSelectedJob(updated);
      }
    }
  }, [jobs, selectedJob, isModalOpen]);

  const totalPages = Math.ceil(jobs.length / JOBS_PER_PAGE);
  const paginatedJobs = jobs.slice(
    (currentPage - 1) * JOBS_PER_PAGE,
    currentPage * JOBS_PER_PAGE
  );

  const handleJobClick = (job: FaceSwapJob) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 flex items-center justify-center">
          <Icon
            icon="solar:refresh-circle-bold-duotone"
            className="text-3xl text-accent-400 animate-spin"
          />
        </CardBody>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 text-center">
          <Icon
            icon="solar:mask-happly-bold-duotone"
            className="text-4xl text-text-tertiary mx-auto mb-3"
          />
          <p className="text-text-secondary">No face swaps yet</p>
          <p className="text-xs text-text-tertiary mt-1">
            Create your first face swap above
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedJobs.map((job) => (
            <FaceSwapJobCard
              key={job.id}
              job={job}
              onClick={() => handleJobClick(job)}
            />
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center pt-4">
            <Pagination
              total={totalPages}
              page={currentPage}
              onChange={setCurrentPage}
              color="primary"
              size="sm"
              showControls
            />
          </div>
        )}
      </div>
      <FaceSwapDetailModal
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
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

function ScalePlanRequired({ currentPlan }: { currentPlan: string }) {
  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-accent-400/10 flex items-center justify-center mx-auto">
              <Icon
                icon="solar:mask-happly-bold-duotone"
                className="text-accent-400"
                width={40}
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-text-primary">
                UGC Studio
              </h1>
              <p className="text-text-secondary">
                Create AI-powered face swaps and more with UGC Studio.
              </p>
            </div>
            <Button
              as="a"
              href="/dashboard/pricing"
              className="bg-accent-400 text-white font-semibold"
              size="lg"
              startContent={<Icon icon="solar:arrow-up-bold" width={20} />}
            >
              Upgrade to Scale
            </Button>
            <p className="text-xs text-text-muted">
              Currently on:{" "}
              <span className="capitalize font-medium">{currentPlan}</span> plan
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function UGCStudioPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);

  if (selectedTeam?.plan !== "scale") {
    return <ScalePlanRequired currentPlan={selectedTeam?.plan || "free"} />;
  }

  return <UGCStudioContent selectedTeam={selectedTeam} />;
}

function UGCStudioContent({
  selectedTeam,
}: {
  selectedTeam: { id: number; plan?: string };
}) {
  const [currentView, setCurrentView] = useState<StudioView>("face-swap");
  const [video, setVideo] = useState<UploadedFile | null>(null);
  const [selectedCharacter, setSelectedCharacter] =
    useState<SelectedCharacter | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [clipRange, setClipRange] = useState<[number, number]>([0, 30]);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingCharacterId, setLoadingCharacterId] = useState<string | null>(
    null
  );
  const [processingStatus, setProcessingStatus] = useState("");
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobRefreshTrigger, setJobRefreshTrigger] = useState(0);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const characterImage = selectedCharacter
    ? {
        file: selectedCharacter.file || new File([], "example.jpg"),
        preview: selectedCharacter.src,
      }
    : null;

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
      if (!validTypes.includes(file.type)) return;

      if (video?.preview) URL.revokeObjectURL(video.preview);

      const preview = URL.createObjectURL(file);
      setVideo({ file, preview });

      const videoEl = document.createElement("video");
      videoEl.src = preview;
      videoEl.onloadedmetadata = () => {
        const duration = videoEl.duration;
        setVideoDuration(duration);
        const maxEnd = Math.min(duration, 30);
        setClipRange([0, maxEnd]);
      };
    },
    [video]
  );

  const handleImageSelect = useCallback(
    (file: File) => {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) return;

      if (characterImage?.preview) URL.revokeObjectURL(characterImage.preview);

      const preview = URL.createObjectURL(file);
      setSelectedCharacter({ type: "uploaded", src: preview, file });
    },
    [selectedCharacter]
  );

  const handleExampleSelect = async (id: string, src: string) => {
    if (selectedCharacter?.type === "uploaded" && selectedCharacter.src) {
      URL.revokeObjectURL(selectedCharacter.src);
    }
    setLoadingCharacterId(id);
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const filename = src.split("/").pop() || "character.jpg";
      const file = new File([blob], filename, { type: blob.type });
      setSelectedCharacter({ type: "example", src, file });
    } catch {
      setSelectedCharacter({ type: "example", src });
    } finally {
      setLoadingCharacterId(null);
    }
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
    setProcessingStatus("Uploading files...");
    setSubmittedJobId(null);

    try {
      const formData = new FormData();
      formData.append("video", video.file);
      formData.append("image", characterImage.file);
      formData.append("teamId", selectedTeam.id.toString());
      formData.append("startTime", clipRange[0].toString());
      formData.append("endTime", clipRange[1].toString());

      const response = await apiFetch(`${API_URL}/comfy/ugc-face-swap`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit job");
      }

      const data = await response.json();
      setSubmittedJobId(data.jobId);
      setProcessingStatus("Job submitted! Processing...");
      setJobRefreshTrigger((prev) => prev + 1);

      addToast({
        title: "Face swap started!",
        description:
          "Your video is being processed. This may take 20-40 minutes.",
        color: "success",
      });

      if (video?.preview) URL.revokeObjectURL(video.preview);
      if (characterImage?.preview) URL.revokeObjectURL(characterImage.preview);
      setVideo(null);
      setSelectedCharacter(null);
      setVideoDuration(0);
      setClipRange([0, 30]);
    } catch (err) {
      console.error("Generate error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      addToast({
        title: "Failed to start face swap",
        description: errorMessage,
        color: "danger",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
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
    setSubmittedJobId(null);
    setError(null);
    setProcessingStatus("");
  };

  const clipDuration = Math.round((clipRange[1] - clipRange[0]) * 100) / 100;

  if (currentView === "menu") {
    return (
      <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">
              UGC Studio
            </h1>
            <p className="text-text-secondary mt-1">
              Create AI-powered user-generated content
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      Swap faces in your videos with AI
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

          {selectedTeam?.id && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-text-primary">
                My Face Swaps
              </h2>
              <MyFaceSwapsSection
                teamId={selectedTeam.id}
                refreshTrigger={jobRefreshTrigger}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      startContent={
                        <Icon icon="solar:refresh-bold" width={16} />
                      }
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

            {selectedTeam?.id && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-text-primary">
                  My Face Swaps
                </h2>
                <MyFaceSwapsSection
                  teamId={selectedTeam.id}
                  refreshTrigger={jobRefreshTrigger}
                />
              </div>
            )}
          </div>

          <div className="space-y-6">
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
                      Upload the face to swap
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
                        src={characterImage ? characterImage.preview : ""}
                        alt="Character"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        className="absolute top-2 right-2 bg-surface-base/80"
                        onPress={() => {
                          if (characterImage && characterImage.preview)
                            URL.revokeObjectURL(characterImage.preview);
                          setSelectedCharacter(null);
                        }}
                      >
                        <Icon icon="solar:close-circle-bold" width={18} />
                      </Button>
                    </div>
                    {selectedCharacter.type === "uploaded" &&
                      selectedCharacter.file && (
                        <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
                          <Icon icon="solar:gallery-bold-duotone" width={16} />
                          <span className="truncate">
                            {selectedCharacter.file.name}
                          </span>
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
                      <p className="text-xs text-text-tertiary mb-2">
                        Choose an example
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {EXAMPLE_CHARACTERS.map((char) => (
                          <button
                            key={char.id}
                            onClick={() =>
                              handleExampleSelect(String(char.id), char.src)
                            }
                            disabled={loadingCharacterId !== null}
                            className={`aspect-square rounded-lg overflow-hidden border-2 transition-all focus:outline-none ${
                              loadingCharacterId === String(char.id)
                                ? "border-purple-500 opacity-50"
                                : "border-transparent hover:border-purple-500 hover:scale-105"
                            }`}
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

            <Card className="bg-surface-base border border-border-base">
              <CardBody className="p-4">
                {isProcessing ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-400/20 flex items-center justify-center">
                        <Icon
                          icon="solar:cloud-upload-bold-duotone"
                          className="text-accent-400 animate-pulse"
                          width={22}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {processingStatus || "Processing..."}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          This may take a moment
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
                ) : submittedJobId ? (
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
                          Job Submitted!
                        </p>
                        <p className="text-xs text-text-tertiary">
                          Check progress below
                        </p>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-accent-400 text-white font-semibold"
                      size="lg"
                      onPress={() => setSubmittedJobId(null)}
                      startContent={
                        <Icon icon="solar:add-circle-bold" width={20} />
                      }
                    >
                      Generate Clips
                    </Button>
                  </div>
                ) : error ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg">
                      <Icon
                        icon="solar:danger-circle-bold"
                        className="text-red-500"
                        width={20}
                      />
                      <p className="text-sm text-red-500">{error}</p>
                    </div>
                    <Button
                      className="w-full bg-accent-400 text-white font-semibold"
                      size="lg"
                      onPress={() => setError(null)}
                      startContent={
                        <Icon icon="solar:refresh-bold" width={20} />
                      }
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
                          className={`w-2.5 h-2.5 rounded-full ${video && clipDuration <= 30.01 ? "bg-green-500" : "bg-surface-elevated"}`}
                        />
                        <span
                          className={`text-sm ${video && clipDuration <= 30.01 ? "text-text-primary" : "text-text-tertiary"}`}
                        >
                          Clip selected (≤30s)
                        </span>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-accent-400 text-white font-semibold"
                      size="lg"
                      isDisabled={
                        !video || !characterImage || clipDuration > 30.01
                      }
                      onPress={handleGenerate}
                      startContent={
                        <Icon
                          icon="solar:magic-stick-3-bold-duotone"
                          width={20}
                        />
                      }
                      endContent={
                        <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                          5 Credits
                        </span>
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
