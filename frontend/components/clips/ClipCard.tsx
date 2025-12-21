"use client";

import React, { useState, memo, useRef, useEffect } from "react";
import { Card, Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Clip } from "@/api/clips";

interface ClipCardProps {
  clip: Clip;
  viewMode?: "grid" | "list";
  onDelete?: (clipId: number) => void;
  onView?: () => void;
  onEdit?: () => void;
}

const ClipCardComponent: React.FC<ClipCardProps> = ({
  clip,
  viewMode = "grid",
  onDelete,
  onView,
  onEdit,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleDownload = async (e: any) => {
    if (!clip.clipUrl || isDownloading) return;

    setIsDownloading(true);
    try {
      // Use direct link download to avoid CORS issues with S3
      const link = document.createElement("a");
      link.href = clip.clipUrl;
      link.download = `${clip.title || `clip-${clip.id}`}.mp4`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
    setIsDragging(true);

    const dragPreview = document.createElement("div");
    dragPreview.style.cssText =
      "display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #1A1A1A; border: 1px solid #9333EA; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);";
    dragPreview.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 7V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V7C3 4 4.5 2 8 2H16C19.5 2 21 4 21 7Z" stroke="#9333EA" stroke-width="1.5"/>
        <path d="M9.5 12L12 14.5L14.5 12" stroke="#9333EA" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span style="color: #E5E5E5; font-size: 13px; font-weight: 500; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${clip.title || `Clip #${clip.id}`}</span>
    `;
    dragPreview.style.position = "absolute";
    dragPreview.style.top = "-1000px";
    document.body.appendChild(dragPreview);

    e.dataTransfer.setDragImage(dragPreview, 0, 0);

    setTimeout(() => document.body.removeChild(dragPreview), 0);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleCardPress = () => {
    if (onView && !isDragging) {
      onView();
    }
  };

  const handleDelete = () => {
    if (onDelete) onDelete(clip.id);
  };

  const handleEdit = () => {
    if (onEdit) onEdit();
  };

  const handleView = () => {
    if (onView) onView();
  };

  const handleListClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    if (onView && !isDragging) {
      onView();
    }
  };

  if (viewMode === "list") {
    return (
      <div
        ref={cardRef}
        className={`flex items-center gap-4 p-3 bg-surface-base border border-border-accent rounded-lg hover:bg-surface-elevated transition-all cursor-pointer ${
          isDragging ? "opacity-50" : ""
        }`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleListClick}
      >
        <div className="w-16 h-10 flex-shrink-0 bg-surface-dark rounded overflow-hidden">
          {clip.clipUrl && isVisible ? (
            <video
              src={clip.clipUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon
                icon="solar:video-frame-play-vertical-bold-duotone"
                className="text-lg text-accent-400"
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-primary truncate">
            {clip.title || `Clip #${clip.id}`}
          </h3>
        </div>

        {clip.clip_score !== undefined && clip.clip_score !== null && (
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${getScoreClasses(clip.clip_score)}`}
          >
            <Icon icon="solar:star-bold" className="text-xs" />
            <span className="text-xs font-medium">{clip.clip_score}</span>
          </div>
        )}

        {clip.tags && clip.tags.length > 0 && (
          <div className="hidden md:flex items-center gap-1">
            {clip.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <div className="text-xs text-text-tertiary w-16 text-right hidden sm:block">
          {formatDate(clip.updated_at)}
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content="View">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="w-8 h-8 min-w-8"
              onPress={handleView}
            >
              <Icon
                icon="solar:eye-bold"
                className="text-lg text-text-secondary"
              />
            </Button>
          </Tooltip>

          {onEdit && clip.captions_data && (
            <Tooltip content="Edit">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="w-8 h-8 min-w-8"
                onPress={handleEdit}
              >
                <Icon
                  icon="solar:pen-bold"
                  className="text-lg text-text-secondary"
                />
              </Button>
            </Tooltip>
          )}

          <Tooltip content="Download">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="w-8 h-8 min-w-8"
              onPress={handleDownload}
              isDisabled={!clip.clipUrl || isDownloading}
            >
              <Icon
                icon={
                  isDownloading
                    ? "svg-spinners:ring-resize"
                    : "solar:download-bold"
                }
                className="text-lg text-text-secondary"
              />
            </Button>
          </Tooltip>

          {onDelete && (
            <Tooltip content="Delete">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                className="w-8 h-8 min-w-8"
                onPress={handleDelete}
              >
                <Icon icon="mdi:delete-outline" className="text-lg" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
    );
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if clicking on a button
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    handleCardPress();
  };

  return (
    <Card
      ref={cardRef}
      className={`bg-surface-base border border-border-accent hover:bg-surface-elevated transition-all cursor-pointer h-[180px] ${
        isDragging ? "opacity-50 scale-95" : ""
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full" onClick={handleCardClick}>
        <div className="w-24 flex-shrink-0 bg-surface-dark">
          {clip.clipUrl && isVisible ? (
            <video
              src={clip.clipUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon
                icon="solar:video-frame-play-vertical-bold-duotone"
                className="text-3xl text-accent-400"
              />
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-w-0 p-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-text-primary truncate flex-1">
              {clip.title || `Clip #${clip.id}`}
            </h3>
            {clip.clip_score !== undefined && clip.clip_score !== null && (
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full flex-shrink-0 ${getScoreClasses(clip.clip_score)}`}
              >
                <Icon icon="solar:star-bold" className="text-xs" />
                <span className="text-xs font-medium">{clip.clip_score}</span>
              </div>
            )}
          </div>

          {clip.message && (
            <p className="text-xs text-text-secondary line-clamp-2 mb-2">
              {clip.message}
            </p>
          )}

          {clip.tags && clip.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {clip.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </span>
              ))}
              {clip.tags.length > 2 && (
                <span className="text-xs text-text-tertiary">
                  +{clip.tags.length - 2}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-text-tertiary mb-2">
            <Icon icon="solar:clock-circle-outline" className="text-sm" />
            <span>{formatDate(clip.updated_at)}</span>
          </div>

          <div className="mt-auto flex items-center gap-1">
            <Tooltip content="View">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="w-8 h-8 min-w-8"
                onPress={handleView}
              >
                <Icon
                  icon="solar:eye-bold"
                  className="text-lg text-text-secondary"
                />
              </Button>
            </Tooltip>

            {onEdit && clip.captions_data && (
              <Tooltip content="Edit">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  className="w-8 h-8 min-w-8"
                  onPress={handleEdit}
                >
                  <Icon
                    icon="solar:pen-bold"
                    className="text-lg text-text-secondary"
                  />
                </Button>
              </Tooltip>
            )}

            <Tooltip content={isDownloading ? "Downloading..." : "Download"}>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="w-8 h-8 min-w-8"
                onPress={handleDownload}
                isDisabled={!clip.clipUrl || isDownloading}
              >
                <Icon
                  icon={
                    isDownloading
                      ? "svg-spinners:ring-resize"
                      : "solar:download-bold"
                  }
                  className="text-lg text-text-secondary"
                />
              </Button>
            </Tooltip>

            {onDelete && (
              <Tooltip content="Delete">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  className="w-8 h-8 min-w-8"
                  onPress={handleDelete}
                >
                  <Icon icon="mdi:delete-outline" className="text-lg" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export const ClipCard = memo(ClipCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.clip.id === nextProps.clip.id &&
    prevProps.clip.updated_at === nextProps.clip.updated_at &&
    prevProps.clip.clipUrl === nextProps.clip.clipUrl &&
    prevProps.clip.raw_video_path === nextProps.clip.raw_video_path &&
    prevProps.viewMode === nextProps.viewMode
  );
});
