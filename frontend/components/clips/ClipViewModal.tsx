"use client";

import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Progress,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface Folder {
  id: number;
  name: string;
  color?: string;
}

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface Clip {
  id: number;
  folder_id?: number | null;
  message?: string;
  clip_score?: number;
  clip_metadata?: any;
  input_metadata?: any;
  prompt?: string;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  clipUrl?: string;
  sourceVideoUrl?: string;
  tags?: Tag[];
  share_token?: string | null;
}

interface ClipViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clip: Clip;
  folders?: Folder[];
  availableTags?: Tag[];
  onMoveToFolder?: (clipId: number, folderId: number | null) => void;
  onTagsChange?: (clipId: number, tagIds: number[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<Tag>;
  onDeleteTag?: (tagId: number) => Promise<void>;
  onGenerateShareLink?: (clipId: number) => Promise<string>;
  onRemoveShareLink?: (clipId: number) => Promise<void>;
}

const TAG_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];

export default function ClipViewModal({
  isOpen,
  onClose,
  clip,
  folders = [],
  availableTags = [],
  onMoveToFolder,
  onTagsChange,
  onCreateTag,
  onDeleteTag,
  onGenerateShareLink,
  onRemoveShareLink,
}: ClipViewModalProps) {
  const [isMoving, setIsMoving] = useState(false);
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    clip.tags?.map((t) => t.id) || []
  );
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [deletingTagId, setDeletingTagId] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(clip.share_token || null);
  const [showShareTooltip, setShowShareTooltip] = useState(false);

  React.useEffect(() => {
    setSelectedTagIds(clip.tags?.map((t) => t.id) || []);
  }, [clip.tags]);

  React.useEffect(() => {
    setShareToken(clip.share_token || null);
  }, [clip.share_token]);

  const getStatusColor = () => {
    switch (clip.status) {
      case "completed":
        return "success";
      case "failed":
        return "danger";
      case "pending":
        return "warning";
      default:
        return "default";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "success";
    if (score >= 60) return "warning";
    return "danger";
  };

  const handleDownload = async () => {
    if (!clip.clipUrl) return;

    try {
      const response = await fetch(clip.clipUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clip_${clip.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleMove = async (folderId: number | null) => {
    if (!onMoveToFolder) return;
    setIsMoving(true);
    try {
      await onMoveToFolder(clip.id, folderId);
    } finally {
      setIsMoving(false);
    }
  };

  const handleTagToggle = async (tagId: number) => {
    if (!onTagsChange) return;
    setIsUpdatingTags(true);
    try {
      const newTagIds = selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId];
      setSelectedTagIds(newTagIds);
      await onTagsChange(clip.id, newTagIds);
    } finally {
      setIsUpdatingTags(false);
    }
  };

  const handleCreateTag = async () => {
    if (!onCreateTag || !newTagName.trim()) return;
    setIsCreatingTag(true);
    try {
      const newTag = await onCreateTag(newTagName.trim(), newTagColor);
      setNewTagName("");
      setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
      if (onTagsChange) {
        const newTagIds = [...selectedTagIds, newTag.id];
        setSelectedTagIds(newTagIds);
        await onTagsChange(clip.id, newTagIds);
      }
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleDeleteTag = async (tagId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDeleteTag) return;
    if (!confirm("Delete this tag? It will be removed from all clips.")) return;
    setDeletingTagId(tagId);
    try {
      await onDeleteTag(tagId);
      setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
    } finally {
      setDeletingTagId(null);
    }
  };

  const handleShare = async () => {
    if (!onGenerateShareLink) return;
    setIsSharing(true);
    try {
      const token = await onGenerateShareLink(clip.id);
      setShareToken(token);
      const url = `${window.location.origin}/shared/${token}`;
      await navigator.clipboard.writeText(url);
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2000);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveShare = async () => {
    if (!onRemoveShareLink) return;
    setIsSharing(true);
    try {
      await onRemoveShareLink(clip.id);
      setShareToken(null);
    } finally {
      setIsSharing(false);
    }
  };

  const getShareUrl = () => {
    if (!shareToken) return "";
    return `${window.location.origin}/shared/${shareToken}`;
  };

  const handleCopyShareLink = async () => {
    const url = getShareUrl();
    await navigator.clipboard.writeText(url);
    setShowShareTooltip(true);
    setTimeout(() => setShowShareTooltip(false), 2000);
  };

  const currentFolder = folders.find((f) => f.id === clip.folder_id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
      classNames={{
        wrapper: "z-[9999] isolate",
        backdrop: "z-[9998]",
        base: "bg-surface-base border border-border-base z-[9999]",
        header: "border-b border-border-base",
        body: "py-6",
        footer: "border-t border-border-base",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">
              Clip Details
            </h2>
          </div>
        </ModalHeader>
        <ModalBody>
          {clip.status === "failed" && clip.error_message && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500">
              <div className="flex items-center gap-2 mb-2">
                <Icon
                  icon="solar:danger-circle-bold"
                  className="text-xl text-red-500"
                />
                <span className="font-semibold text-red-500">Error</span>
              </div>
              <p className="text-sm text-red-400">{clip.error_message}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
            <div className="flex items-center justify-center">
              {clip.clipUrl ? (
                <div className="rounded-lg overflow-hidden bg-black w-full h-full flex items-center justify-center relative z-10">
                  <video
                    src={clip.clipUrl}
                    controls
                    className="max-w-full max-h-[600px] object-contain relative z-10"
                    autoPlay
                  />
                </div>
              ) : (
                <div className="rounded-lg bg-surface-elevated w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Icon
                      icon="solar:video-frame-play-vertical-bold-duotone"
                      className="text-6xl text-text-tertiary mb-2"
                    />
                    <p className="text-text-secondary">Video not available</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[600px]">
              {onMoveToFolder && folders.length > 0 && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Icon
                      icon="solar:folder-bold-duotone"
                      className="text-accent-400"
                    />
                    Organization
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-primary">
                      {currentFolder ? (
                        <span className="flex items-center gap-2">
                          <Icon
                            icon="solar:folder-bold-duotone"
                            style={{ color: currentFolder.color || "#3B82F6" }}
                          />
                          {currentFolder.name}
                        </span>
                      ) : (
                        "Unorganized"
                      )}
                    </span>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button
                          size="sm"
                          variant="flat"
                          isLoading={isMoving}
                          startContent={
                            !isMoving && <Icon icon="solar:folder-send-bold" />
                          }
                        >
                          Move to...
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Move to folder"
                        items={[
                          ...(clip.folder_id !== null
                            ? [
                                {
                                  id: "unorganized",
                                  name: "Unorganized",
                                  color: undefined,
                                },
                              ]
                            : []),
                          ...folders
                            .filter((f) => f.id !== clip.folder_id)
                            .map((f) => ({
                              id: String(f.id),
                              name: f.name,
                              color: f.color,
                            })),
                        ]}
                        onAction={(key) => {
                          if (key === "unorganized") {
                            handleMove(null);
                          } else {
                            handleMove(Number(key));
                          }
                        }}
                      >
                        {(item) => (
                          <DropdownItem
                            key={item.id}
                            startContent={
                              item.id === "unorganized" ? (
                                <Icon
                                  icon="solar:inbox-bold-duotone"
                                  className="text-text-tertiary"
                                />
                              ) : (
                                <Icon
                                  icon="solar:folder-bold-duotone"
                                  style={{ color: item.color || "#3B82F6" }}
                                />
                              )
                            }
                          >
                            {item.name}
                          </DropdownItem>
                        )}
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                </div>
              )}

              {onTagsChange && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Icon
                      icon="solar:tag-bold-duotone"
                      className="text-accent-400"
                    />
                    Tags
                  </h3>

                  {availableTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {availableTags.map((tag) => {
                        const isSelected = selectedTagIds.includes(tag.id);
                        const isDeleting = deletingTagId === tag.id;
                        return (
                          <div
                            key={tag.id}
                            className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                              isSelected
                                ? "ring-2 ring-offset-1 ring-offset-surface-elevated"
                                : "opacity-60 hover:opacity-100"
                            }`}
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            <button
                              onClick={() => handleTagToggle(tag.id)}
                              disabled={isUpdatingTags || isDeleting}
                              className="inline-flex items-center gap-1.5"
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                              {isSelected && (
                                <Icon
                                  icon="solar:check-circle-bold"
                                  className="text-sm"
                                />
                              )}
                            </button>
                            {onDeleteTag && (
                              <button
                                onClick={(e) => handleDeleteTag(tag.id, e)}
                                disabled={isDeleting}
                                className="opacity-0 group-hover:opacity-100 hover:scale-110 transition-all ml-0.5"
                                title="Delete tag"
                              >
                                {isDeleting ? (
                                  <Icon
                                    icon="solar:spinner-bold"
                                    className="text-sm animate-spin"
                                  />
                                ) : (
                                  <Icon
                                    icon="solar:close-circle-bold"
                                    className="text-sm"
                                  />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {onCreateTag && (
                    <div className="border-t border-border-base pt-3 mt-3">
                      <p className="text-xs text-text-tertiary mb-2">
                        Create new tag
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewTagColor(color)}
                            className={`w-5 h-5 rounded-full transition-all ${
                              newTagColor === color
                                ? "ring-2 ring-offset-1 ring-offset-surface-elevated scale-110"
                                : "opacity-60 hover:opacity-100"
                            }`}
                            style={{
                              backgroundColor: color,
                              outlineColor:
                                newTagColor === color ? color : undefined,
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleCreateTag()
                          }
                          placeholder="Tag name..."
                          className="flex-1 min-w-0 px-2 py-1 text-sm bg-surface-dark border border-border-base rounded text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-400"
                        />
                        <Button
                          size="sm"
                          isDisabled={!newTagName.trim() || isCreatingTag}
                          isLoading={isCreatingTag}
                          onPress={handleCreateTag}
                          className="bg-accent-400 text-white shrink-0"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {availableTags.length === 0 && !onCreateTag && (
                    <p className="text-xs text-text-tertiary">
                      No tags available
                    </p>
                  )}
                </div>
              )}

              {clip.clip_score !== null && clip.clip_score !== undefined && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3">
                    Clip Score
                  </h3>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl font-bold text-text-primary">
                      {clip.clip_score}
                    </span>
                    <span className="text-text-tertiary">/100</span>
                  </div>
                  <Progress
                    value={clip.clip_score}
                    color={getScoreColor(clip.clip_score)}
                    className="h-2"
                  />
                </div>
              )}

              {clip.message && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                    <Icon
                      icon="solar:chat-square-bold-duotone"
                      className="text-accent-400"
                    />
                    AI Analysis
                  </h3>
                  <p className="text-sm text-text-primary leading-relaxed">
                    {clip.message}
                  </p>
                </div>
              )}

              {clip.prompt && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                    <Icon
                      icon="solar:pen-bold-duotone"
                      className="text-accent-400"
                    />
                    Prompt Used
                  </h3>
                  <p className="text-sm text-text-primary leading-relaxed italic">
                    "{clip.prompt}"
                  </p>
                </div>
              )}

              {clip.input_metadata && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Icon
                      icon="solar:file-bold-duotone"
                      className="text-accent-400"
                    />
                    Source Info
                  </h3>
                  <div className="space-y-2">
                    {clip.input_metadata.originalFileName && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-text-tertiary min-w-[50px]">
                          File:
                        </span>
                        <p className="text-sm text-text-primary break-all">
                          {clip.input_metadata.originalFileName}
                        </p>
                      </div>
                    )}
                    {clip.input_metadata.fileSize && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-tertiary min-w-[50px]">
                          Size:
                        </span>
                        <p className="text-sm text-text-primary">
                          {(
                            clip.input_metadata.fileSize /
                            (1024 * 1024)
                          ).toFixed(2)}{" "}
                          MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {clip.clip_metadata?.parameters && (
                <div className="p-4 rounded-lg bg-surface-elevated">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Icon
                      icon="solar:settings-bold-duotone"
                      className="text-accent-400"
                    />
                    Parameters
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {clip.clip_metadata.parameters.length && (
                      <div className="p-2 rounded bg-surface-dark">
                        <p className="text-xs text-text-tertiary">Length</p>
                        <p className="text-sm text-text-primary font-medium">
                          {clip.clip_metadata.parameters.length}s
                        </p>
                      </div>
                    )}
                    {clip.clip_metadata.parameters.hookLength && (
                      <div className="p-2 rounded bg-surface-dark">
                        <p className="text-xs text-text-tertiary">Hook</p>
                        <p className="text-sm text-text-primary font-medium">
                          {clip.clip_metadata.parameters.hookLength}s
                        </p>
                      </div>
                    )}
                    {clip.clip_metadata.parameters.promptType && (
                      <div className="p-2 rounded bg-surface-dark">
                        <p className="text-xs text-text-tertiary">Type</p>
                        <p className="text-sm text-text-primary font-medium capitalize">
                          {clip.clip_metadata.parameters.promptType}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg bg-surface-elevated">
                <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                  <Icon
                    icon="solar:calendar-bold-duotone"
                    className="text-accent-400"
                  />
                  Created
                </h3>
                <p className="text-sm text-text-primary">
                  {new Date(clip.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex justify-between">
          <Button variant="flat" onPress={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            {onGenerateShareLink && clip.clipUrl && (
              <>
                {shareToken ? (
                  <div className="flex items-center gap-2 relative">
                    {showShareTooltip && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-success-500 text-white text-xs rounded whitespace-nowrap z-10">
                        Copied!
                      </div>
                    )}
                    <div
                      className="px-3 py-2 bg-default-100 rounded-lg text-sm text-default-600 truncate max-w-[180px] cursor-pointer hover:bg-default-200 transition-colors"
                      title={getShareUrl()}
                      onClick={handleCopyShareLink}
                    >
                      {getShareUrl()}
                    </div>
                    <Button
                      variant="flat"
                      color="success"
                      isIconOnly
                      onPress={handleCopyShareLink}
                      title="Copy link"
                    >
                      <Icon icon="solar:copy-bold" />
                    </Button>
                    <Button
                      variant="flat"
                      color="danger"
                      isIconOnly
                      isLoading={isSharing}
                      onPress={handleRemoveShare}
                      title="Disable sharing"
                    >
                      <Icon icon="solar:link-broken-bold" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="flat"
                    startContent={!isSharing && <Icon icon="solar:share-bold" />}
                    isLoading={isSharing}
                    onPress={handleShare}
                  >
                    Share
                  </Button>
                )}
              </>
            )}
            {clip.clipUrl && (
              <Button
                color="primary"
                startContent={<Icon icon="solar:download-bold" />}
                onPress={handleDownload}
              >
                Download
              </Button>
            )}
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
