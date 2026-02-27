"use client";

import React from "react";
import { CommentOverlayData } from "@/store/videoEditor";

interface CommentPreviewProps {
  commentData: CommentOverlayData;
  scale: number; // containerHeight / 1920
}

function DefaultAvatar({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#C4C4C4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .66.54 1.2 1.2 1.2h16.8c.66 0 1.2-.54 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
}

function ProfilePic({ url, size }: { url?: string; size: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt="Profile"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  return <DefaultAvatar size={size} />;
}

export function CommentPreview({ commentData, scale }: CommentPreviewProps) {
  const s = (v: number) => Math.round(v * scale);

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: s(16),
        padding: `${s(16)}px ${s(20)}px`,
        display: "inline-flex",
        flexDirection: "column",
        gap: s(10),
        maxWidth: s(760),
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Header: "Reply to @username's comment" */}
      <div
        style={{
          color: "#8A8A8A",
          fontSize: s(16),
          fontWeight: 600,
        }}
      >
        Reply to @{commentData.username}&apos;s comment
      </div>

      {/* Avatar + Comment Text */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: s(14),
        }}
      >
        <ProfilePic url={commentData.profilePictureUrl} size={s(52)} />
        <div
          style={{
            color: "#000000",
            fontSize: s(20),
            fontWeight: 700,
            lineHeight: 1.3,
            wordWrap: "break-word",
            flex: 1,
            minWidth: 0,
          }}
        >
          {commentData.commentText}
        </div>
      </div>
    </div>
  );
}
