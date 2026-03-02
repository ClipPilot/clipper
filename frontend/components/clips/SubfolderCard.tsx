"use client";

import React, { memo, useState } from "react";
import { Card, Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Folder } from "@/api/clips";

interface SubfolderCardProps {
  folder: Folder;
  viewMode?: "grid" | "list";
  onOpen: (folderId: number) => void;
  onDelete?: (folderId: number) => void;
  onDropClip?: (clipId: number, folderId: number) => void;
  onDownload?: (folderId: number) => void;
}

const SubfolderCardComponent: React.FC<SubfolderCardProps> = ({
  folder,
  viewMode = "grid",
  onOpen,
  onDelete,
  onDropClip,
  onDownload,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("folderId", folder.id.toString());
    e.dataTransfer.setData("type", "folder");
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);

    const dragPreview = document.createElement("div");
    dragPreview.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #1A1A1A; border: 1px solid #9333EA; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);";
    const folderColor = folder.color || "#3B82F6";
    dragPreview.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + folderColor + '"><path d="M21.0002 7V17C21.0002 20 19.5002 22 16.0002 22H8.00024C4.50024 22 3.00024 20 3.00024 17V7C3.00024 4 4.50024 2 8.00024 2H9.00024C10.1002 2 11.1402 2.53 11.8202 3.4L12.8202 4.7C13.2402 5.23 13.8002 5.5 14.4002 5.5H16.0002C19.5002 5.5 21.0002 7 21.0002 10V7Z"/></svg><span style="color: #E5E5E5; font-size: 14px; font-weight: 500;">' + folder.name + '</span>';
    dragPreview.style.position = "absolute";
    dragPreview.style.top = "-1000px";
    document.body.appendChild(dragPreview);

    e.dataTransfer.setDragImage(dragPreview, 0, 0);

    setTimeout(() => document.body.removeChild(dragPreview), 0);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    if (!isDragging) {
      onOpen(folder.id);
    }
  };

  const handleDelete = () => {
    if (onDelete) onDelete(folder.id);
  };

  const handleOpen = () => {
    onOpen(folder.id);
  };

  const handleFolderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only show drop target for clips, not when dragging folders
    const type = e.dataTransfer.types.includes("clipid") ||
                 (e.dataTransfer.types.includes("text/plain") && !e.dataTransfer.types.includes("folderid"));
    if (onDropClip) {
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleFolderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const clipIdStr = e.dataTransfer.getData("clipId");
    if (clipIdStr && onDropClip) {
      const clipId = parseInt(clipIdStr);
      onDropClip(clipId, folder.id);
    }
  };

  if (viewMode === "list") {
    return (
      <div
        className={`flex items-center gap-4 p-3 bg-surface-base rounded-lg transition-all cursor-pointer ${
          isDragging ? "opacity-50" : ""
        } ${
          isDragOver
            ? "bg-accent-400/20 border-2 border-accent-400 border-dashed shadow-[0_0_12px_rgba(147,51,234,0.4)]"
            : "border border-border-accent hover:bg-surface-elevated"
        }`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleFolderDragOver}
        onDragLeave={handleFolderDragLeave}
        onDrop={handleFolderDrop}
        onClick={handleCardClick}
      >
        <div className="w-16 h-10 flex-shrink-0 flex items-center justify-center">
          <Icon
            icon="solar:folder-bold-duotone"
            className="text-3xl"
            style={{ color: folder.color || "#3B82F6" }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-primary truncate">
            {folder.name}
          </h3>
        </div>

        <div className="text-xs text-text-tertiary w-16 text-right hidden sm:block">
          {formatDate(folder.updated_at)}
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content="Open">
            <Button isIconOnly size="sm" variant="light" className="w-8 h-8 min-w-8" onPress={handleOpen}>
              <Icon icon="solar:folder-open-bold" className="text-lg text-text-secondary" />
            </Button>
          </Tooltip>

          {onDownload && (
            <Tooltip content="Download as ZIP">
              <Button isIconOnly size="sm" variant="light" className="w-8 h-8 min-w-8" onPress={() => onDownload(folder.id)}>
                <Icon icon="solar:download-minimalistic-outline" className="text-lg text-text-secondary" />
              </Button>
            </Tooltip>
          )}

          {onDelete && (
            <Tooltip content="Delete">
              <Button isIconOnly size="sm" variant="light" color="danger" className="w-8 h-8 min-w-8" onPress={handleDelete}>
                <Icon icon="mdi:delete-outline" className="text-lg" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card
      isPressable
      className={`bg-surface-base transition-all cursor-pointer h-[180px] ${
        isDragging ? "opacity-50 scale-95" : ""
      } ${
        isDragOver
          ? "bg-accent-400/20 border-2 border-accent-400 border-dashed shadow-[0_0_12px_rgba(147,51,234,0.4)]"
          : "border border-border-accent hover:bg-surface-elevated"
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleFolderDragOver}
      onDragLeave={handleFolderDragLeave}
      onDrop={handleFolderDrop}
      onPress={() => onOpen(folder.id)}
    >
      <div className="flex flex-col h-full p-4">
        <div className="flex-1 flex items-center justify-center">
          <Icon
            icon="solar:folder-bold-duotone"
            className="text-6xl"
            style={{ color: folder.color || "#3B82F6" }}
          />
        </div>

        <div className="mt-2">
          <h3 className="text-sm font-semibold text-text-primary truncate text-center">
            {folder.name}
          </h3>

          {folder.message && (
            <p className="text-xs text-text-secondary line-clamp-1 mt-1 text-center">
              {folder.message}
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center justify-center gap-1">
          <Tooltip content="Open">
            <Button isIconOnly size="sm" variant="light" className="w-8 h-8 min-w-8" onPress={handleOpen}>
              <Icon icon="solar:folder-open-bold" className="text-lg text-text-secondary" />
            </Button>
          </Tooltip>

          {onDownload && (
            <Tooltip content="Download as ZIP">
              <Button isIconOnly size="sm" variant="light" className="w-8 h-8 min-w-8" onPress={() => onDownload(folder.id)}>
                <Icon icon="solar:download-minimalistic-outline" className="text-lg text-text-secondary" />
              </Button>
            </Tooltip>
          )}

          {onDelete && (
            <Tooltip content="Delete">
              <Button isIconOnly size="sm" variant="light" color="danger" className="w-8 h-8 min-w-8" onPress={handleDelete}>
                <Icon icon="mdi:delete-outline" className="text-lg" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
    </Card>
  );
};

export const SubfolderCard = memo(SubfolderCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.folder.id === nextProps.folder.id &&
    prevProps.folder.updated_at === nextProps.folder.updated_at &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.onDropClip === nextProps.onDropClip &&
    prevProps.onDownload === nextProps.onDownload
  );
});
