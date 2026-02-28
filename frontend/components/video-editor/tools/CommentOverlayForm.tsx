"use client";

import React, { useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Input, Textarea, Button } from "@heroui/react";
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
  CommentOverlayData,
} from "@/store/videoEditor";
import { clipsAPI } from "@/api/clips";
import { COMMENT_DIMENSIONS } from "@/constants/comments";

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

  // Form state (TikTok only)
  const [username, setUsername] = useState("");
  const [commentText, setCommentText] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | undefined>();
  const [profilePictureS3Key, setProfilePictureS3Key] = useState<string | undefined>();

  // Check if we're editing an existing comment overlay
  const isEditing = editingOverlayId && selectedOverlay?.type === "comment" && selectedOverlay.commentData;

  const loadFromOverlay = (overlay: MediaOverlay) => {
    if (overlay.commentData) {
      setUsername(overlay.commentData.username);
      setCommentText(overlay.commentData.commentText);
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
      platform: "tiktok",
      username: username.trim(),
      commentText: commentText.trim(),
      profilePictureUrl,
      profilePictureS3Key,
      likesCount: 0,
      isVerified: false,
      timeAgo: "",
    };

    const dims = COMMENT_DIMENSIONS.tiktok;

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
        fileName: "tiktok_comment",
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

    // Reset form (skip revoking the blob URL since the overlay now owns it)
    if (!isEditing) {
      resetForm(true);
      setShowForm(false);
    }
  };

  const resetForm = (keepBlobUrl = false) => {
    setUsername("");
    setCommentText("");
    if (!keepBlobUrl && profilePictureUrl) URL.revokeObjectURL(profilePictureUrl);
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
          <Icon icon="simple-icons:tiktok" className="text-accent-400" />
          {isEditing ? "Edit TikTok Comment" : "New TikTok Comment"}
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
