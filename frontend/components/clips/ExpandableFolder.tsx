"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Folder, Clip } from "@/api/clips";
import { ClipCard } from "./ClipCard";

interface ExpandableFolderProps {
  folder: Folder;
  clips: Clip[];
  onDelete?: (folderId: number) => void;
  onDrop?: (folderId: number, clipId: number) => void;
  onClipDelete?: (clipId: number) => void;
  onClipEdit?: (clip: Clip) => void;
  draggedClipId?: number | null;
  onClipDragStart?: (e: React.DragEvent, clipId: number) => void;
  onClipDragEnd?: () => void;
}

export const ExpandableFolder: React.FC<ExpandableFolderProps> = ({
  folder,
  clips,
  onDelete,
  onDrop,
  onClipDelete,
  onClipEdit,
  draggedClipId,
  onClipDragStart,
  onClipDragEnd
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleToggle = () => {
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const clipId = e.dataTransfer.getData("clipId");
    if (clipId && onDrop) {
      onDrop(folder.id, parseInt(clipId));
    }
  };

  return (
    <div className="mb-2">
      {/* Folder Row */}
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
        {/* Expand/Collapse Arrow */}
        <div className="flex-shrink-0">
          <Icon 
            icon={isExpanded ? "solar:alt-arrow-down-bold" : "solar:alt-arrow-right-bold"}
            className="text-lg text-text-secondary transition-transform"
          />
        </div>

        {/* Folder Icon */}
        <div className="flex-shrink-0">
          <Icon 
            icon={isExpanded ? "solar:folder-open-bold-duotone" : "solar:folder-bold-duotone"}
            className="text-3xl transition-colors"
            style={{ color: folder.color || "#3B82F6" }}
          />
        </div>

        {/* Folder Name & Count */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {folder.name}
            </h3>
            <span className="text-xs text-text-tertiary">
              ({clips.length})
            </span>
          </div>
          {folder.message && !isExpanded && (
            <p className="text-xs text-text-secondary truncate">
              {folder.message}
            </p>
          )}
        </div>

        {/* Actions */}
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

      {/* Expanded Content */}
      {isExpanded && (
        <div className="ml-12 mt-2 space-y-2">
          {folder.message && (
            <p className="text-sm text-text-secondary mb-3 px-3">
              {folder.message}
            </p>
          )}
          
          {clips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {clips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  onDelete={onClipDelete}
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

