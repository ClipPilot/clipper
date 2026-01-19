"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { clipsAPI, Folder, FolderTreeNode } from "@/api/clips";
import { CreateFolderModal } from "./CreateFolderModal";

interface FolderSelectorProps {
  teamId: number;
  selectedFolderId: number | null;
  onFolderSelect: (folderId: number | null) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

interface FolderTreeItemProps {
  folder: FolderTreeNode;
  selectedFolderId: number | null;
  onSelect: (folderId: number) => void;
  depth?: number;
}

function FolderTreeItem({
  folder,
  selectedFolderId,
  onSelect,
  depth = 0,
}: FolderTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedFolderId === folder.id;

  return (
    <div>
      <button
        onClick={() => onSelect(folder.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
          isSelected
            ? "bg-accent-400/20 text-accent-400"
            : "hover:bg-surface-elevated text-text-primary"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 -ml-1 hover:bg-surface-base rounded"
          >
            <Icon
              icon={isExpanded ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-right-linear"}
              className="text-text-muted"
              width={14}
            />
          </button>
        )}
        {!hasChildren && <div className="w-4" />}
        <Icon
          icon="solar:folder-bold-duotone"
          className="flex-shrink-0"
          style={{ color: folder.color || "#3B82F6" }}
          width={18}
        />
        <span className="truncate text-sm">{folder.name}</span>
        {isSelected && (
          <Icon
            icon="solar:check-circle-bold"
            className="ml-auto text-accent-400 flex-shrink-0"
            width={16}
          />
        )}
      </button>
      {hasChildren && isExpanded && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderSelector({
  teamId,
  selectedFolderId,
  onFolderSelect,
  label,
  placeholder = "No folder (root)",
  className = "",
  size = "md",
}: FolderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isOpen: isCreateModalOpen, onOpen: openCreateModal, onClose: closeCreateModal } = useDisclosure();

  const fetchFolders = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    try {
      const [tree, allFolders] = await Promise.all([
        clipsAPI.getFolderTree(teamId),
        clipsAPI.getFolders(teamId),
      ]);
      setFolderTree(tree);
      setFolders(allFolders);
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (isOpen && folderTree.length === 0 && !isLoading) {
      fetchFolders();
    }
  }, [isOpen, fetchFolders, folderTree.length, isLoading]);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const handleSelect = (folderId: number) => {
    onFolderSelect(folderId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFolderSelect(null);
  };

  const handleCreateFolder = async (data: {
    name: string;
    color?: string;
    message?: string;
    parentFolderId?: number | null;
  }) => {
    const newFolder = await clipsAPI.createFolder(teamId, data);
    await fetchFolders();
    onFolderSelect(newFolder.id);
    closeCreateModal();
  };

  const sizeClasses = {
    sm: "h-8 text-xs",
    md: "h-10 text-sm",
    lg: "h-12 text-base",
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-2">
          {label}
        </label>
      )}
      <Popover
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        placement="bottom-start"
        classNames={{
          content: "bg-surface-base border border-border-accent p-0 w-72",
        }}
      >
        <PopoverTrigger>
          <Button
            variant="bordered"
            className={`w-full justify-start border-border-base bg-surface-elevated ${sizeClasses[size]}`}
            startContent={
              selectedFolder ? (
                <Icon
                  icon="solar:folder-bold-duotone"
                  style={{ color: selectedFolder.color || "#3B82F6" }}
                  width={18}
                />
              ) : (
                <Icon
                  icon="solar:folder-outline"
                  className="text-text-muted"
                  width={18}
                />
              )
            }
            endContent={
              <div className="flex items-center gap-1 ml-auto">
                {selectedFolderId && (
                  <button
                    onClick={handleClear}
                    className="p-1 hover:bg-surface-base rounded-full"
                  >
                    <Icon icon="solar:close-circle-bold" className="text-text-muted" width={16} />
                  </button>
                )}
                <Icon
                  icon="solar:alt-arrow-down-linear"
                  className="text-text-muted"
                  width={16}
                />
              </div>
            }
          >
            <span className="truncate text-text-primary">
              {selectedFolder?.name || placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <div className="max-h-64 overflow-y-auto py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" color="primary" />
              </div>
            ) : folderTree.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <Icon
                  icon="solar:folder-add-bold-duotone"
                  className="text-text-tertiary mx-auto mb-2"
                  width={32}
                />
                <p className="text-sm text-text-secondary mb-3">No folders yet</p>
                <Button
                  size="sm"
                  className="bg-accent-400 text-white"
                  onPress={openCreateModal}
                  startContent={<Icon icon="solar:add-circle-bold" width={16} />}
                >
                  Create Folder
                </Button>
              </div>
            ) : (
              <>
                {/* Root option */}
                <button
                  onClick={() => {
                    onFolderSelect(null);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    selectedFolderId === null
                      ? "bg-accent-400/20 text-accent-400"
                      : "hover:bg-surface-elevated text-text-secondary"
                  }`}
                >
                  <Icon icon="solar:home-2-outline" width={18} />
                  <span className="text-sm">{placeholder}</span>
                  {selectedFolderId === null && (
                    <Icon
                      icon="solar:check-circle-bold"
                      className="ml-auto text-accent-400"
                      width={16}
                    />
                  )}
                </button>
                <div className="border-t border-border-base my-1" />
                {folderTree.map((folder) => (
                  <FolderTreeItem
                    key={folder.id}
                    folder={folder}
                    selectedFolderId={selectedFolderId}
                    onSelect={handleSelect}
                  />
                ))}
              </>
            )}
          </div>
          {folderTree.length > 0 && (
            <>
              <div className="border-t border-border-base" />
              <div className="p-2">
                <Button
                  size="sm"
                  variant="light"
                  className="w-full justify-start text-text-secondary"
                  onPress={openCreateModal}
                  startContent={<Icon icon="solar:add-folder-bold" width={16} />}
                >
                  New Folder
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      <CreateFolderModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        onCreate={handleCreateFolder}
      />
    </div>
  );
}
