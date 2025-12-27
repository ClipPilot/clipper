"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { FolderTreeNode } from "@/api/clips";

interface FolderTreeItemProps {
  folder: FolderTreeNode;
  level: number;
  selectedFolderId: number | null;
  expandedFolderIds: Set<number>;
  dragOverFolderId: number | null;
  draggingFolderId: number | null;
  isReadOnly?: boolean;
  onSelect: (folderId: number) => void;
  onToggle: (folderId: number) => void;
  onDragOver: (e: React.DragEvent, folderId: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, folderId: number) => void;
  onFolderDragStart: (e: React.DragEvent, folderId: number) => void;
  onFolderDragEnd: () => void;
  onDelete?: (folderId: number) => void;
  onCreateSubfolder?: (parentFolderId: number) => void;
}

export const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  level,
  selectedFolderId,
  expandedFolderIds,
  dragOverFolderId,
  draggingFolderId,
  isReadOnly = false,
  onSelect,
  onToggle,
  onDragOver,
  onDragLeave,
  onDrop,
  onFolderDragStart,
  onFolderDragEnd,
  onDelete,
  onCreateSubfolder,
}) => {
  const isExpanded = expandedFolderIds.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const isDragOver = dragOverFolderId === folder.id;
  const isDragging = draggingFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(folder.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(folder.id);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();

    const dragPreview = document.createElement("div");
    dragPreview.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #1A1A1A; border: 1px solid #9333EA; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);";
    dragPreview.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="${folder.color || '#3B82F6'}">
        <path d="M21.0002 7V17C21.0002 20 19.5002 22 16.0002 22H8.00024C4.50024 22 3.00024 20 3.00024 17V7C3.00024 4 4.50024 2 8.00024 2H9.00024C10.1002 2 11.1402 2.53 11.8202 3.4L12.8202 4.7C13.2402 5.23 13.8002 5.5 14.4002 5.5H16.0002C19.5002 5.5 21.0002 7 21.0002 10V7Z"/>
      </svg>
      <span style="color: #E5E5E5; font-size: 14px; font-weight: 500;">${folder.name}</span>
    `;
    dragPreview.style.position = "absolute";
    dragPreview.style.top = "-1000px";
    dragPreview.style.left = "-1000px";
    document.body.appendChild(dragPreview);

    e.dataTransfer.setDragImage(dragPreview, 0, 0);

    setTimeout(() => {
      document.body.removeChild(dragPreview);
    }, 0);

    onFolderDragStart(e, folder.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver(e, folder.id);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragLeave(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop(e, folder.id);
  };

  const handleDelete = () => {
    onDelete?.(folder.id);
  };

  const handleCreateSubfolder = () => {
    onCreateSubfolder?.(folder.id);
  };

  return (
    <div className={isDragging ? "opacity-50" : ""}>
      <div
        draggable={!isReadOnly}
        onDragStart={isReadOnly ? undefined : handleDragStart}
        onDragEnd={isReadOnly ? undefined : onFolderDragEnd}
        onDragOver={isReadOnly ? undefined : handleDragOver}
        onDragLeave={isReadOnly ? undefined : handleDragLeave}
        onDrop={isReadOnly ? undefined : handleDrop}
        onClick={handleClick}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        className={`
          flex items-center gap-2 py-1.5 pr-2 rounded-lg cursor-pointer group transition-all relative
          ${isSelected && !isDragOver ? "bg-accent-400/20 border border-accent-400/50" : ""}
          ${!isSelected && !isDragOver ? "hover:bg-surface-elevated border border-transparent" : ""}
          ${isDragOver && !isReadOnly ? "bg-accent-400/40 border-2 border-accent-400 border-dashed shadow-[0_0_12px_rgba(147,51,234,0.4)]" : ""}
        `}
      >
        <button
          onClick={handleToggle}
          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-surface-hover transition-colors ${!hasChildren ? "invisible" : ""}`}
        >
          <Icon
            icon={isExpanded ? "solar:alt-arrow-down-bold" : "solar:alt-arrow-right-bold"}
            className="text-xs text-text-secondary"
          />
        </button>

        <Icon
          icon={isExpanded ? "solar:folder-open-bold-duotone" : "solar:folder-bold-duotone"}
          className="text-xl flex-shrink-0"
          style={{ color: folder.color || "#3B82F6" }}
        />

        <span className="flex-1 text-sm text-text-primary truncate">{folder.name}</span>

        {!isReadOnly && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onCreateSubfolder && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="w-6 h-6 min-w-6"
                onPress={handleCreateSubfolder}
              >
                <Icon icon="solar:add-circle-outline" className="text-sm text-text-secondary" />
              </Button>
            )}
            {onDelete && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                className="w-6 h-6 min-w-6"
                onPress={handleDelete}
              >
                <Icon icon="mdi:delete-outline" className="text-base" />
              </Button>
            )}
          </div>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              expandedFolderIds={expandedFolderIds}
              dragOverFolderId={dragOverFolderId}
              draggingFolderId={draggingFolderId}
              isReadOnly={isReadOnly}
              onSelect={onSelect}
              onToggle={onToggle}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onFolderDragStart={onFolderDragStart}
              onFolderDragEnd={onFolderDragEnd}
              onDelete={onDelete}
              onCreateSubfolder={onCreateSubfolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};
