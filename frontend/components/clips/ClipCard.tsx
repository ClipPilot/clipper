"use client";

import React, { useState, memo, useRef, useEffect } from "react";
import { Card, CardBody, CardFooter, Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Clip } from "@/api/clips";

interface ClipCardProps {
  clip: Clip;
  onDelete?: (clipId: number) => void;
  onView?: () => void;
  onEdit?: () => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, clipId: number) => void;
  onDragEnd?: () => void;
}

const ClipCardComponent: React.FC<ClipCardProps> = ({ clip, onDelete, onView, onEdit, isDragging, onDragStart, onDragEnd }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleDownload = async () => {
    if (!clip.clipUrl || isDownloading) return;

    setIsDownloading(true);
    try {
      const response = await fetch(clip.clipUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${clip.title || `clip-${clip.id}`}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download clip:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getScoreClasses = (score?: number) => {
    if (!score && score !== 0) return "text-accent-400 bg-accent-400/10";
    if (score >= 80) return "text-success-600 bg-success-600/10";
    if (score >= 60) return "text-warning-600 bg-warning-600/10";
    return "text-text-tertiary bg-surface-elevated";
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("clipId", clip.id.toString());
    e.dataTransfer.effectAllowed = "move";
    if (onDragStart) {
      onDragStart(e, clip.id);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (onView && !isDragging) {
      onView();
    }
  };

  return (
    <Card
      ref={cardRef}
      className={`bg-surface-base border border-border-accent hover:bg-surface-elevated transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50 scale-95" : ""
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      <CardBody className="p-3 sm:p-4 cursor-pointer" onClick={handleCardClick}>
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex-shrink-0">
            <div className="w-16 sm:w-20 md:w-24 h-28 sm:h-36 md:h-44 rounded-lg overflow-hidden border border-border-base bg-surface-elevated flex items-center justify-center">
              {clip.clipUrl && isVisible ? (
                <video
                  src={clip.clipUrl}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-surface-dark">
                  <Icon icon="solar:video-frame-play-vertical-bold-duotone" className="text-2xl sm:text-3xl text-accent-400" />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs sm:text-sm font-semibold text-text-primary truncate">
                {clip.title ? clip.title : `Clip #${clip.id}`}
              </h3>
              {clip.clip_score !== undefined && clip.clip_score !== null && (
                <div className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full ${getScoreClasses(clip.clip_score)}`}>
                  <Icon icon="solar:star-bold" className="text-xs" />
                  <span className="text-xs font-medium">{clip.clip_score}</span>
                </div>
              )}
            </div>

            {clip.message && (
              <p className="text-xs text-text-secondary line-clamp-2 mb-2 hidden sm:block">
                {clip.message}
              </p>
            )}

            {clip.tags && clip.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {clip.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full hidden sm:block"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate max-w-[60px] sm:max-w-none">{tag.name}</span>
                  </span>
                ))}
                {clip.tags.length > 2 && (
                  <span className="text-xs text-text-tertiary">
                    +{clip.tags.length - 2}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 sm:gap-3 text-xs text-text-tertiary">
              <div className="flex items-center gap-1">
                <Icon icon="solar:clock-circle-outline" className="text-sm" />
                <span className="hidden sm:inline">{formatDate(clip.updated_at)}</span>
                <span className="sm:hidden">{new Date(clip.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </CardBody>

      <CardFooter className="px-2 sm:px-4 py-2 border-t border-border-base flex justify-between gap-1 sm:gap-2">
        {onView && (
          <Tooltip content="View" className="sm:hidden">
            <Button
              size="sm"
              variant="light"
              className="text-xs text-text-secondary hover:text-accent-400 min-w-0 px-2 sm:px-3"
              startContent={<Icon icon="solar:eye-outline" className="text-base" />}
              onPress={onView}
            >
              <span className="hidden sm:inline">View</span>
            </Button>
          </Tooltip>
        )}

        {onEdit && clip.captions_data && (
          <Tooltip content="Edit" className="sm:hidden">
            <Button
              size="sm"
              variant="light"
              className="text-xs text-text-secondary hover:text-accent-400 min-w-0 px-2 sm:px-3"
              startContent={<Icon icon="solar:pen-outline" className="text-base" />}
              onPress={onEdit}
            >
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </Tooltip>
        )}

        <Tooltip content={isDownloading ? "Downloading..." : "Download"} className="sm:hidden">
          <Button
            size="sm"
            variant="light"
            className="text-xs text-text-secondary hover:text-accent-400 min-w-0 px-2 sm:px-3"
            startContent={<Icon icon={isDownloading ? "solar:loading-circle-bold" : "solar:download-outline"} className={`text-base ${isDownloading ? "animate-spin" : ""}`} />}
            onPress={handleDownload}
            isDisabled={!clip.clipUrl || isDownloading}
          >
            <span className="hidden sm:inline">{isDownloading ? "Downloading..." : "Download"}</span>
          </Button>
        </Tooltip>

        {onDelete && (
          <Tooltip content="Delete" className="sm:hidden">
            <Button
              size="sm"
              variant="light"
              color="danger"
              className="text-xs min-w-0 px-2 sm:px-3"
              startContent={<Icon icon="solar:trash-bin-outline" className="text-base" />}
              onPress={() => onDelete(clip.id)}
            >
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </Tooltip>
        )}
      </CardFooter>
    </Card>
  );
};

export const ClipCard = memo(ClipCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.clip.id === nextProps.clip.id &&
    prevProps.clip.updated_at === nextProps.clip.updated_at &&
    prevProps.clip.clipUrl === nextProps.clip.clipUrl &&
    prevProps.isDragging === nextProps.isDragging
  );
});
