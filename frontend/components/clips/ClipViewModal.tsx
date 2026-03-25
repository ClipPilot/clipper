"use client";

import React, { useState } from "react";
import { Modal,
  Button,
  Chip,
  ProgressBar,
  Dropdown,
  Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useDownloadVideo } from "@/hooks/useDownloadVideo";
import { adPostingAPI, ClipPost } from "@/api/adPosting";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";

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
  title?: string;
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
  source?: "clip" | "ugc" | "faceswap";
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
  onUpdateTitle?: (clipId: number, title: string) => Promise<void>;
  onAdPosting?: () => void;
  onEdit?: () => void;
}

const PLATFORM_META: Record<string, { name: string; icon: string }> = {
  tiktok: { name: "TikTok", icon: "logos:tiktok-icon" },
  instagram: { name: "Instagram", icon: "skill-icons:instagram" },
  facebook: { name: "Facebook", icon: "logos:facebook" },
  youtube: { name: "YouTube", icon: "logos:youtube-icon" },
  x: { name: "X", icon: "ri:twitter-x-fill" },
};

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
  onUpdateTitle,
  onAdPosting,
  onEdit,
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
  const [shareToken, setShareToken] = useState<string | null>(
    clip.share_token || null
  );
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const { isDownloading, download } = useDownloadVideo();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(clip.title || "");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [clipPosts, setClipPosts] = useState<ClipPost[]>([]);
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    setSelectedTagIds(clip.tags?.map((t) => t.id) || []);
  }, [clip.tags]);

  React.useEffect(() => {
    setShareToken(clip.share_token || null);
  }, [clip.share_token]);

  React.useEffect(() => {
    setEditedTitle(clip.title || "");
  }, [clip.title]);

  React.useEffect(() => {
    if (isOpen && selectedTeam?.id && clip.id) {
      adPostingAPI
        .getClipPosts(selectedTeam.id, clip.id)
        .then(setClipPosts)
        .catch(() => setClipPosts([]));
    } else {
      setClipPosts([]);
    }
  }, [isOpen, selectedTeam?.id, clip.id]);

  const handleSaveTitle = async () => {
    if (!onUpdateTitle || editedTitle === clip.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    try {
      await onUpdateTitle(clip.id, editedTitle);
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to save title:", error);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const getSourceLabel = () => {
    const metadataType = clip.clip_metadata?.type;
    if (metadataType === "ugc") return { label: "AI UGC", color: "secondary" };
    if (metadataType === "face-swap") return { label: "Face Swap", color: "warning" };
    return { label: "Clip", color: "primary" };
  };

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

  const handleDownload = () => {
    if (!clip.clipUrl) return;
    download({
      url: clip.clipUrl,
      filename: `clip_${clip.id}.mp4`,
      isFaceSwap: clip.clip_metadata?.type === "face-swap",
    });
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
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}><Modal.Container scroll="inside"><Modal.Dialog className="sm:max-w-4xl">
        <Modal.Header className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
 value={editedTitle}
 onChange={(e) => setEditedTitle(e.target.value)}
 placeholder="Enter title..."
 className="w-64 rounded-lg border border-border-base bg-surface-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-400/40 focus:border-accent-400"
 onKeyDown={(e) => {
 if (e.key === "Enter") handleSaveTitle();
 if (e.key === "Escape") {
 setEditedTitle(clip.title || "");
 setIsEditingTitle(false);
 }
 }}
 autoFocus
 />
                  <Button variant="primary"
 size="sm"
 isPending={isSavingTitle}
 onPress={handleSaveTitle}
 className="bg-accent-400"
 >
                    Save
                  </Button>
                  <Button
 size="sm"
 variant="tertiary"
 onPress={() => {
 setEditedTitle(clip.title || "");
 setIsEditingTitle(false);
 }}
 >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-text-accent">
                    {editedTitle || `Clip #${clip.id}`}
                  </h2>
                  {onUpdateTitle && (
                    <Button
 size="sm"
 variant="tertiary"
 isIconOnly
 onPress={() => setIsEditingTitle(true)}
 >
                      <Icon icon="solar:pen-bold" className="text-text-secondary" />
                    </Button>
                  )}
                </>
              )}
              <Chip
 size="sm"
 color={getSourceLabel().color as any}
 variant="tertiary"
 >
                {getSourceLabel().label}
              </Chip>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
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
            <div className="flex items-center justify-center isolate">
              {clip.clipUrl ? (
                <div className="rounded-lg overflow-hidden bg-black w-full h-full flex items-center justify-center relative z-10">
                  <video
                    key={`clip-video-${clip.id}-${clip.clipUrl}`}
                    src={clip.clipUrl}
                    controls
                    controlsList="nodownload noremoteplayback"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
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
                <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                    <Icon
                      icon="solar:folder-bold-duotone"
                      className="text-accent-400"
                    />
                    Organization
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-accent">
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
<Button
 size="sm"
 variant="tertiary"
 isPending={isMoving}
 >
                          {!isMoving && <Icon icon="solar:folder-send-bold" />}
                          Move to...
                        </Button>
<Dropdown.Popover>

<Dropdown.Menu
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
                          <Dropdown.Item
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
                          </Dropdown.Item>
                        )}
                      </Dropdown.Menu>
</Dropdown.Popover>
                    </Dropdown>
                  </div>
                </div>
              )}

              {onTagsChange && (
                <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
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
                          className="flex-1 min-w-0 px-2 py-1 text-sm bg-surface-dark border border-border-base rounded text-text-accent placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-400"
                        />
                        <Button
 size="sm"
 isDisabled={!newTagName.trim() || isCreatingTag}
 isPending={isCreatingTag}
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
                <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
                  <h3 className="text-sm font-semibold text-text-secondary mb-3">
                    Clip Score
                  </h3>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl font-bold text-text-accent">
                      {clip.clip_score}
                    </span>
                    <span className="text-text-tertiary">/100</span>
                  </div>
                  <ProgressBar
 value={clip.clip_score}
 className="h-2"
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
                </div>
              )}

              {clip.message && (
                <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                    <Icon
                      icon="solar:chat-square-bold-duotone"
                      className="text-accent-400"
                    />
                    AI Analysis
                  </h3>
                  <p className="text-sm text-text-accent leading-relaxed">
                    {clip.message}
                  </p>
                </div>
              )}

              {clip.prompt && (
                <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                    <Icon
                      icon="solar:pen-bold-duotone"
                      className="text-accent-400"
                    />
                    Prompt Used
                  </h3>
                  <p className="text-sm text-text-accent leading-relaxed italic">
                    "{clip.prompt}"
                  </p>
                </div>
              )}

              {clip.input_metadata && (
                <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
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
                        <p className="text-sm text-text-accent break-all">
                          {clip.input_metadata.originalFileName}
                        </p>
                      </div>
                    )}
                    {clip.input_metadata.fileSize && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-tertiary min-w-[50px]">
                          Size:
                        </span>
                        <p className="text-sm text-text-accent">
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
                <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
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
                        <p className="text-sm text-text-accent font-medium">
                          {clip.clip_metadata.parameters.length}s
                        </p>
                      </div>
                    )}
                    {clip.clip_metadata.parameters.hookLength && (
                      <div className="p-2 rounded bg-surface-dark">
                        <p className="text-xs text-text-tertiary">Hook</p>
                        <p className="text-sm text-text-accent font-medium">
                          {clip.clip_metadata.parameters.hookLength}s
                        </p>
                      </div>
                    )}
                    {clip.clip_metadata.parameters.promptType && (
                      <div className="p-2 rounded bg-surface-dark">
                        <p className="text-xs text-text-tertiary">Type</p>
                        <p className="text-sm text-text-accent font-medium capitalize">
                          {clip.clip_metadata.parameters.promptType}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {clipPosts.length > 0 && (() => {
                const grouped = clipPosts.reduce<Record<string, ClipPost[]>>((acc, post) => {
                  (acc[post.platform] ??= []).push(post);
                  return acc;
                }, {});

                const formatTimeAgo = (dateStr: string) => {
                  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
                  if (diffSec < 60) return "just now";
                  const diffMin = Math.floor(diffSec / 60);
                  if (diffMin < 60) return `${diffMin}m ago`;
                  const diffHour = Math.floor(diffMin / 60);
                  if (diffHour < 24) return `${diffHour}h ago`;
                  return `${Math.floor(diffHour / 24)}d ago`;
                };

                return (
                  <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
                    <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                      <Icon icon="mdi:megaphone" className="text-accent-400" />
                      Ad Posts
                      <Chip size="sm" variant="tertiary">{clipPosts.length}</Chip>
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(grouped).map(([platform, platformPosts]) => {
                        const meta = PLATFORM_META[platform] || { name: platform, icon: "mdi:web" };
                        const postedCount = platformPosts.filter(p => p.status === "posted").length;
                        const scheduledCount = platformPosts.filter(p => p.status === "scheduled").length;
                        const failedCount = platformPosts.filter(p => p.status === "failed").length;
                        const isExpanded = expandedPlatforms.has(platform);
                        const showToggle = platformPosts.length > 3;

                        return (
                          <div key={platform} className="rounded-lg bg-surface-dark p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon icon={meta.icon} className="text-lg" />
                                <span className="text-sm font-medium text-text-accent">
                                  {meta.name}
                                </span>
                                <span className="text-xs text-text-tertiary">
                                  · {platformPosts.length} {platformPosts.length === 1 ? "copy" : "copies"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {postedCount > 0 && (
                                  <Chip size="sm" variant="tertiary" color="success">
                                    {postedCount} posted
                                  </Chip>
                                )}
                                {scheduledCount > 0 && (
                                  <Chip size="sm" variant="tertiary" color="warning">
                                    {scheduledCount} scheduled
                                  </Chip>
                                )}
                                {failedCount > 0 && (
                                  <Chip size="sm" variant="tertiary" color="danger">
                                    {failedCount} failed
                                  </Chip>
                                )}
                              </div>
                            </div>

                            {(isExpanded || !showToggle) && (
                              <div className="mt-2 space-y-1">
                                {(isExpanded ? platformPosts : platformPosts.slice(0, 3)).map((post) => (
                                  <div
                                    key={post.id}
                                    className="flex items-center justify-between py-1.5 px-2 rounded bg-surface-elevated text-xs"
                                  >
                                    <div className="flex items-center gap-2 text-text-tertiary">
                                      <span className="text-text-secondary font-mono">#{post.id}</span>
                                      <Chip
 size="sm"
 variant="tertiary"
 color={
 post.status === "posted"
 ? "success"
 : post.status === "scheduled"
 ? "warning"
 : "danger"
 }
 >
                                        {post.status}
                                      </Chip>
                                      <span>{formatTimeAgo(post.created_at)}</span>
                                    </div>
                                    {post.status === "posted" && post.post_url && (
                                      <a href={post.post_url} target="_blank" rel="noopener noreferrer">
                                        <Button size="sm" variant="tertiary" isIconOnly>
                                          <Icon icon="solar:square-top-down-bold" className="text-accent-400" />
                                        </Button>
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {showToggle && (
                              <Button
 size="sm"
 variant="tertiary"
 className="mt-2 text-xs text-accent-400"
 onPress={() => {
 setExpandedPlatforms(prev => {
 const next = new Set(prev);
 if (next.has(platform)) next.delete(platform);
 else next.add(platform);
 return next;
 });
 }}
 >
                                {isExpanded ? "Show less" : `Show all ${platformPosts.length}`}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
                <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                  <Icon
                    icon="solar:calendar-bold-duotone"
                    className="text-accent-400"
                  />
                  Created
                </h3>
                <p className="text-sm text-text-accent">
                  {new Date(clip.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="flex justify-between">
          <Button variant="tertiary" onPress={onClose}>
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
 variant="tertiary"
 isIconOnly
 onPress={handleCopyShareLink}
 title="Copy link"
 >
                      <Icon icon="solar:copy-bold" />
                    </Button>
                    <Button
 variant="danger-soft"
 isIconOnly
 isPending={isSharing}
 onPress={handleRemoveShare}
 title="Disable sharing"
 >
                      <Icon icon="solar:link-broken-bold" />
                    </Button>
                  </div>
                ) : (
                  <Button
 variant="tertiary"
 isPending={isSharing}
 onPress={handleShare}
 >
                    {!isSharing && <Icon icon="solar:share-bold" />}
                    Share
                  </Button>
                )}
              </>
            )}
            {onEdit && clip.clipUrl && clip.clip_metadata?.type !== "face-swap" && (
              <Button
 variant="tertiary"
 onPress={onEdit}
 >
                <Icon icon="solar:pen-bold" />
                Edit
              </Button>
            )}
            {onAdPosting && clip.clipUrl && (
              <Button
 variant="tertiary"
 onPress={onAdPosting}
 >
                <Icon icon="solar:video-library-bold-duotone" />
                Add to Campaign
              </Button>
            )}
            {clip.clipUrl && (
              <Button variant="primary"
 isPending={isDownloading}
 onPress={handleDownload}
 >
                {!isDownloading && <Icon icon="solar:download-bold" />}
                {isDownloading ? "Processing..." : "Download"}
              </Button>
            )}
          </div>
        </Modal.Footer>
      </Modal.Dialog></Modal.Container></Modal.Backdrop>
    </Modal>
  );
}
