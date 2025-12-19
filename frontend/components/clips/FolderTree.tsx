"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { FolderTreeNode } from "@/api/clips";
import { FolderTreeItem } from "./FolderTreeItem";

interface FolderTreeProps {
  folders: FolderTreeNode[];
  selectedFolderId: number | null;
  isCollapsed: boolean;
  onSelectFolder: (folderId: number | null) => void;
  onToggleCollapse: () => void;
  onMoveClip: (clipId: number, folderId: number | null) => Promise<void>;
  onMoveFolder: (folderId: number, parentFolderId: number | null) => Promise<void>;
  onCreateFolder: (parentFolderId?: number | null) => void;
  onDeleteFolder: (folderId: number) => void;
}

const getDescendantIds = (folderId: number, folders: FolderTreeNode[]): number[] => {
  const descendants: number[] = [];

  const findDescendants = (nodes: FolderTreeNode[]) => {
    for (const node of nodes) {
      if (node.id === folderId) {
        const collectAll = (n: FolderTreeNode) => {
          descendants.push(n.id);
          n.children.forEach(collectAll);
        };
        node.children.forEach(collectAll);
        return true;
      }
      if (findDescendants(node.children)) return true;
    }
    return false;
  };

  findDescendants(folders);
  return descendants;
};

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  selectedFolderId,
  isCollapsed,
  onSelectFolder,
  onToggleCollapse,
  onMoveClip,
  onMoveFolder,
  onCreateFolder,
  onDeleteFolder,
}) => {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<number | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);

  const handleToggle = useCallback((folderId: number) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    const dragType = e.dataTransfer.types.includes("folderid") ? "folder" : "clip";

    if (dragType === "folder" && draggingFolderId) {
      const descendants = getDescendantIds(draggingFolderId, folders);
      if (folderId === draggingFolderId || descendants.includes(folderId)) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
    }

    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  }, [draggingFolderId, folders]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    setDragOverFolderId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetFolderId: number) => {
    e.preventDefault();
    setDragOverFolderId(null);

    const clipId = e.dataTransfer.getData("clipId");
    const folderId = e.dataTransfer.getData("folderId");

    if (folderId) {
      const sourceFolderId = parseInt(folderId);
      if (sourceFolderId === targetFolderId) return;

      const descendants = getDescendantIds(sourceFolderId, folders);
      if (descendants.includes(targetFolderId)) return;

      await onMoveFolder(sourceFolderId, targetFolderId);
    } else if (clipId) {
      await onMoveClip(parseInt(clipId), targetFolderId);
    }
  }, [folders, onMoveClip, onMoveFolder]);

  const handleFolderDragStart = useCallback((e: React.DragEvent, folderId: number) => {
    e.dataTransfer.setData("folderId", folderId.toString());
    e.dataTransfer.effectAllowed = "move";
    setDraggingFolderId(folderId);
  }, []);

  const handleFolderDragEnd = useCallback(() => {
    setDraggingFolderId(null);
    setDragOverFolderId(null);
    setIsDragOverRoot(false);
  }, []);

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOverRoot(true);
  }, []);

  const handleRootDragLeave = useCallback(() => {
    setIsDragOverRoot(false);
  }, []);

  const handleRootDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverRoot(false);

    const clipId = e.dataTransfer.getData("clipId");
    const folderId = e.dataTransfer.getData("folderId");

    if (folderId) {
      await onMoveFolder(parseInt(folderId), null);
    } else if (clipId) {
      await onMoveClip(parseInt(clipId), null);
    }
  }, [onMoveClip, onMoveFolder]);

  if (isCollapsed) {
    return (
      <div className="w-12 bg-surface-base border border-border-base rounded-lg p-2 flex flex-col items-center gap-2">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={onToggleCollapse}
        >
          <Icon icon="solar:alt-arrow-right-bold" className="text-lg text-text-secondary" />
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={() => onSelectFolder(null)}
          className={selectedFolderId === null ? "bg-accent-400/20" : ""}
        >
          <Icon icon="solar:home-2-bold-duotone" className="text-lg text-text-secondary" />
        </Button>
        <div className="w-full h-px bg-border-base" />
        {folders.slice(0, 5).map((folder) => (
          <Button
            key={folder.id}
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => onSelectFolder(folder.id)}
            className={selectedFolderId === folder.id ? "bg-accent-400/20" : ""}
          >
            <Icon
              icon="solar:folder-bold-duotone"
              className="text-lg"
              style={{ color: folder.color || "#3B82F6" }}
            />
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-64 bg-surface-base border border-border-base rounded-lg flex flex-col h-fit max-h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between p-3 border-b border-border-base">
        <h3 className="text-sm font-semibold text-text-primary">Folders</h3>
        <div className="flex items-center gap-1">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => onCreateFolder()}
          >
            <Icon icon="solar:add-circle-bold" className="text-lg text-accent-400" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={onToggleCollapse}
          >
            <Icon icon="solar:alt-arrow-left-bold" className="text-lg text-text-secondary" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div
          onClick={() => onSelectFolder(null)}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
          className={`
            flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-all mb-1
            ${selectedFolderId === null && !isDragOverRoot ? "bg-accent-400/20 border border-accent-400/50" : ""}
            ${selectedFolderId !== null && !isDragOverRoot ? "hover:bg-surface-elevated border border-transparent" : ""}
            ${isDragOverRoot ? "bg-accent-400/40 border-2 border-accent-400 border-dashed shadow-[0_0_12px_rgba(147,51,234,0.4)]" : ""}
          `}
        >
          <Icon icon="solar:home-2-bold-duotone" className="text-xl text-accent-400" />
          <span className="text-sm text-text-primary">All Clips</span>
        </div>

        {folders.length > 0 ? (
          folders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              folder={folder}
              level={0}
              selectedFolderId={selectedFolderId}
              expandedFolderIds={expandedFolderIds}
              dragOverFolderId={dragOverFolderId}
              draggingFolderId={draggingFolderId}
              onSelect={onSelectFolder}
              onToggle={handleToggle}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFolderDragStart={handleFolderDragStart}
              onFolderDragEnd={handleFolderDragEnd}
              onDelete={onDeleteFolder}
              onCreateSubfolder={onCreateFolder}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-2 text-center">
            <Icon icon="solar:folder-add-bold-duotone" className="text-3xl text-text-tertiary mb-2" />
            <p className="text-xs text-text-secondary">No folders yet</p>
            <p className="text-xs text-text-tertiary">Click + to create one</p>
          </div>
        )}
      </div>
    </div>
  );
};
