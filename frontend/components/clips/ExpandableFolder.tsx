"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Folder, Clip, clipsAPI } from "@/api/clips";
import { ClipCard } from "./ClipCard";

interface ExpandableFolderProps {
  folder: Folder;
  teamId: number;
  addedClips?: Clip[];
  movedClipIds?: number[];
  onDelete?: (folderId: number) => void;
  onDrop?: (folderId: number, clipId: number) => Promise<Clip | null>;
  onClipDelete?: (clipId: number) => void;
  onClipView?: (clip: Clip) => void;
  onClipEdit?: (clip: Clip) => void;
  draggedClipId?: number | null;
  onClipDragStart?: (e: React.DragEvent, clipId: number) => void;
  onClipDragEnd?: () => void;
}

export const ExpandableFolder: React.FC<ExpandableFolderProps> = ({
  folder,
  teamId,
  addedClips = [],
  movedClipIds = [],
  onDelete,
  onDrop,
  onClipDelete,
  onClipView,
  onClipEdit,
  draggedClipId,
  onClipDragStart,
  onClipDragEnd,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadedClips, setLoadedClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadClips = useCallback(async () => {
    if (hasLoaded || isLoading) return;

    setIsLoading(true);
    try {
      const folderClips = await clipsAPI.getClipsByFolder(teamId, folder.id);
      setLoadedClips(folderClips);
      setHasLoaded(true);
    } catch (error) {
      console.error("Failed to load folder clips:", error);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, folder.id, hasLoaded, isLoading]);

  const displayedClips = React.useMemo(() => {
    const allClipIds = new Set<number>();
    const result: Clip[] = [];

    // addedClips are clips just moved TO this folder - always show them
    addedClips.forEach((clip) => {
      if (!allClipIds.has(clip.id)) {
        allClipIds.add(clip.id);
        result.push(clip);
      }
    });

    // loadedClips are from API - filter out clips that were moved OUT
    loadedClips.forEach((clip) => {
      if (!movedClipIds.includes(clip.id) && !allClipIds.has(clip.id)) {
        allClipIds.add(clip.id);
        result.push(clip);
      }
    });

    return result;
  }, [addedClips, loadedClips, movedClipIds]);

  const clipCount = (hasLoaded || addedClips.length > 0) ? displayedClips.length : null;

  const handleToggle = () => {
    if (!isExpanded && !hasLoaded) {
      loadClips();
    }
    setIsExpanded(!isExpanded);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const clipId = e.dataTransfer.getData("clipId");
    const sourceFolderId = e.dataTransfer.getData("sourceFolderId");

    if (clipId && onDrop) {
      const clipIdNum = parseInt(clipId);
      if (sourceFolderId === String(folder.id)) return;
      await onDrop(folder.id, clipIdNum);
    }
  };

  return (
    <div className="mb-2">
      <div
        className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer group ${
          isDragOver
            ? "bg-accent-400/20 border-2 border-accent-400"
            : "hover:bg-surface-elevated border-2 border-transparent"
        }`}
        onClick={handleToggle}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex-shrink-0">
          <Icon
            icon={isExpanded ? "solar:alt-arrow-down-bold" : "solar:alt-arrow-right-bold"}
            className="text-lg text-text-secondary transition-transform"
          />
        </div>

        <div className="flex-shrink-0">
          <Icon
            icon={isExpanded ? "solar:folder-open-bold-duotone" : "solar:folder-bold-duotone"}
            className="text-3xl transition-colors"
            style={{ color: folder.color || "#3B82F6" }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {folder.name}
            </h3>
            {clipCount !== null && (
              <span className="text-xs text-text-tertiary">({clipCount})</span>
            )}
          </div>
          {folder.message && !isExpanded && (
            <p className="text-xs text-text-secondary truncate">{folder.message}</p>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onDelete && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              onPress={() => onDelete(folder.id)}
              onClick={(e) => e.stopPropagation()}
            >
              <Icon icon="solar:trash-bin-outline" className="text-lg" />
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="ml-12 mt-2 space-y-2">
          {folder.message && (
            <p className="text-sm text-text-secondary mb-3 px-3">{folder.message}</p>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Icon
                icon="solar:loading-circle-bold"
                className="text-3xl animate-spin text-accent-400"
              />
            </div>
          ) : displayedClips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedClips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  onDelete={onClipDelete ? (clipId) => {
                    setLoadedClips(prev => prev.filter(c => c.id !== clipId));
                    onClipDelete(clipId);
                  } : undefined}
                  onView={onClipView ? () => onClipView(clip) : undefined}
                  onEdit={onClipEdit ? () => onClipEdit(clip) : undefined}
                  isDragging={draggedClipId === clip.id}
                  onDragStart={onClipDragStart}
                  onDragEnd={onClipDragEnd}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-3 border-2 border-dashed border-border-base rounded-lg">
              <Icon icon="solar:inbox-outline" className="text-4xl text-text-tertiary mb-2" />
              <p className="text-sm text-text-secondary text-center">
                Drag clips here to organize them
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
