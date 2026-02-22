"use client";

import React, { useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Input, Textarea, Button, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import { selectedTeamAtom } from "@/store/auth";
import {
  mediaOverlaysAtom,
  selectedOverlayIdAtom,
  selectedOverlayAtom,
  editorClipAtom,
  videoDurationAtom,
  generateOverlayId,
  MediaOverlay,
  CommentPlatform,
  CommentOverlayData,
} from "@/store/videoEditor";
import { clipsAPI } from "@/api/clips";

const PLATFORMS: { id: CommentPlatform; label: string; icon: string }[] = [
  { id: "tiktok", label: "TikTok", icon: "simple-icons:tiktok" },
  { id: "youtube", label: "YouTube", icon: "simple-icons:youtube" },
  { id: "instagram", label: "Instagram", icon: "simple-icons:instagram" },
];

// Preset dimensions matching Puppeteer output (CSS pixels)
const COMMENT_DIMENSIONS: Record<CommentPlatform, { width: number; height: number }> = {
  tiktok: { width: 800, height: 160 },
  youtube: { width: 800, height: 180 },
  instagram: { width: 800, height: 140 },
};

interface CommentOverlayFormProps {
  editingOverlayId?: string | null;
}

export function CommentOverlayForm({ editingOverlayId }: CommentOverlayFormProps) {
  const [overlays, setOverlays] = useAtom(mediaOverlaysAtom);
  const [selectedOverlayId, setSelectedOverlayId] = useAtom(selectedOverlayIdAtom);
  const selectedOverlay = useAtomValue(selectedOverlayAtom);
  const clip = useAtomValue(editorClipAtom);
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const videoDuration = useAtomValue(videoDurationAtom);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPfp, setUploadingPfp] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [platform, setPlatform] = useState<CommentPlatform>("tiktok");
  const [username, setUsername] = useState("");
  const [commentText, setCommentText] = useState("");
  const [likesCount, setLikesCount] = useState(1234);
  const [isVerified, setIsVerified] = useState(false);
  const [timeAgo, setTimeAgo] = useState("2h");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | undefined>();
  const [profilePictureS3Key, setProfilePictureS3Key] = useState<string | undefined>();

  // Check if we're editing an existing comment overlay
  const isEditing = editingOverlayId && selectedOverlay?.type === "comment" && selectedOverlay.commentData;

  const loadFromOverlay = (overlay: MediaOverlay) => {
    if (overlay.commentData) {
      setPlatform(overlay.commentData.platform);
      setUsername(overlay.commentData.username);
      setCommentText(overlay.commentData.commentText);
      setLikesCount(overlay.commentData.likesCount);
      setIsVerified(overlay.commentData.isVerified);
      setTimeAgo(overlay.commentData.timeAgo || "2h");
      setProfilePictureUrl(overlay.commentData.profilePictureUrl);
      setProfilePictureS3Key(overlay.commentData.profilePictureS3Key);
    }
  };

  // When editing, sync form state from selected overlay
  React.useEffect(() => {
    if (isEditing && selectedOverlay) {
      loadFromOverlay(selectedOverlay);
      setShowForm(true);
    }
  }, [editingOverlayId]);

  const handleProfilePicSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clip || !selectedTeam?.id) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Profile picture must be less than 5MB");
      return;
    }

    setUploadingPfp(true);
    try {
      const url = URL.createObjectURL(file);
      setProfilePictureUrl(url);

      const { uploadUrl, s3Key } = await clipsAPI.getOverlayUploadUrl(
        selectedTeam.id,
        clip.id,
        file.name,
        file.type
      );
      await clipsAPI.uploadOverlayToS3(uploadUrl, file);
      setProfilePictureS3Key(s3Key);
    } catch (error) {
      console.error("Failed to upload profile picture:", error);
      alert("Failed to upload profile picture");
    } finally {
      setUploadingPfp(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveProfilePic = () => {
    if (profilePictureUrl) URL.revokeObjectURL(profilePictureUrl);
    setProfilePictureUrl(undefined);
    setProfilePictureS3Key(undefined);
  };

  const handleAddComment = () => {
    if (!username.trim() || !commentText.trim()) return;

    const commentData: CommentOverlayData = {
      platform,
      username: username.trim(),
      commentText: commentText.trim(),
      profilePictureUrl,
      profilePictureS3Key,
      likesCount,
      isVerified,
      timeAgo: timeAgo.trim() || "2h",
    };

    const dims = COMMENT_DIMENSIONS[platform];

    if (isEditing && editingOverlayId) {
      // Update existing overlay
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === editingOverlayId
            ? { ...o, commentData, naturalWidth: dims.width, naturalHeight: dims.height }
            : o
        )
      );
    } else {
      // Create new overlay
      const newOverlay: MediaOverlay = {
        id: generateOverlayId(),
        type: "comment",
        s3Key: "",
        fileName: `${platform}_comment`,
        url: "",
        startTime: 0,
        endTime: videoDuration,
        x: 50,
        y: 75,
        scale: 1.5,
        opacity: 1,
        naturalWidth: dims.width,
        naturalHeight: dims.height,
        commentData,
      };

      setOverlays((prev) => [...prev, newOverlay]);
      setSelectedOverlayId(newOverlay.id);
    }

    // Reset form
    if (!isEditing) {
      resetForm();
      setShowForm(false);
    }
  };

  const resetForm = () => {
    setPlatform("tiktok");
    setUsername("");
    setCommentText("");
    setLikesCount(1234);
    setIsVerified(false);
    setTimeAgo("2h");
    if (profilePictureUrl) URL.revokeObjectURL(profilePictureUrl);
    setProfilePictureUrl(undefined);
    setProfilePictureS3Key(undefined);
  };

  if (!showForm) {
    return (
      <Button
        variant="bordered"
        className="w-full"
        onPress={() => setShowForm(true)}
        startContent={<Icon icon="solar:chat-round-dots-bold" />}
      >
        Add Comment Overlay
      </Button>
    );
  }

  return (
    <div className="space-y-4 bg-surface-elevated rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Icon icon="solar:chat-round-dots-bold" className="text-accent-400" />
          {isEditing ? "Edit Comment" : "New Comment Overlay"}
        </div>
        {!isEditing && (
          <Button
            size="sm"
            variant="light"
            isIconOnly
            onPress={() => { resetForm(); setShowForm(false); }}
          >
            <Icon icon="solar:close-circle-bold" />
          </Button>
        )}
      </div>

      {/* Platform Selector */}
      <div>
        <p className="text-xs text-text-tertiary mb-2">Platform Style</p>
        <div className="flex gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-1 justify-center ${
                platform === p.id
                  ? "bg-accent-400/20 text-accent-400 ring-1 ring-accent-400"
                  : "bg-surface-base text-text-secondary hover:bg-surface-hover"
              }`}
            >
              <Icon icon={p.icon} className="text-sm" />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Profile Picture */}
      <div>
        <p className="text-xs text-text-tertiary mb-2">Profile Picture</p>
        <div className="flex items-center gap-3">
          {profilePictureUrl ? (
            <div className="relative">
              <img
                src={profilePictureUrl}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover"
              />
              <button
                onClick={handleRemoveProfilePic}
                className="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 rounded-full flex items-center justify-center"
              >
                <Icon icon="solar:close-circle-bold" className="text-white text-xs" />
              </button>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface-base flex items-center justify-center text-text-tertiary">
              <Icon icon="solar:user-bold" className="text-lg" />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleProfilePicSelect}
          />
          <Button
            size="sm"
            variant="flat"
            onPress={() => fileInputRef.current?.click()}
            isLoading={uploadingPfp}
          >
            {profilePictureUrl ? "Change" : "Upload"}
          </Button>
        </div>
      </div>

      {/* Username */}
      <Input
        label="Username"
        placeholder="username"
        value={username}
        onValueChange={setUsername}
        size="sm"
        maxLength={30}
        startContent={<span className="text-text-tertiary text-sm">@</span>}
      />

      {/* Comment Text */}
      <Textarea
        label="Comment"
        placeholder="Type your comment..."
        value={commentText}
        onValueChange={setCommentText}
        size="sm"
        maxLength={200}
        minRows={2}
        maxRows={4}
      />

      {/* Likes & Verified Row */}
      <div className="flex gap-3">
        <Input
          label="Likes"
          type="number"
          value={String(likesCount)}
          onValueChange={(val) => setLikesCount(Math.max(0, parseInt(val) || 0))}
          size="sm"
          className="flex-1"
          startContent={<Icon icon="solar:heart-bold" className="text-text-tertiary text-sm" />}
        />
        <Input
          label="Time ago"
          placeholder="2h"
          value={timeAgo}
          onValueChange={setTimeAgo}
          size="sm"
          className="w-24"
        />
      </div>

      {/* Verified Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="solar:verified-check-bold" className="text-blue-400" />
          <span className="text-sm text-text-secondary">Verified Badge</span>
        </div>
        <Switch
          size="sm"
          isSelected={isVerified}
          onValueChange={setIsVerified}
        />
      </div>

      {/* Add/Update Button */}
      <Button
        color="primary"
        className="w-full"
        onPress={handleAddComment}
        isDisabled={!username.trim() || !commentText.trim()}
        startContent={<Icon icon={isEditing ? "solar:pen-bold" : "solar:add-circle-bold"} />}
      >
        {isEditing ? "Update Comment" : "Add to Video"}
      </Button>
    </div>
  );
}
