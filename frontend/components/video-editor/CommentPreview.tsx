"use client";

import React from "react";
import { CommentOverlayData } from "@/store/videoEditor";

interface CommentPreviewProps {
  commentData: CommentOverlayData;
  scale: number; // containerHeight / 1920
}

const formatLikesCount = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
};

const hashColor = (str: string): string => {
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

function DefaultAvatar({ username, size }: { username: string; size: number }) {
  const color = hashColor(username);
  const initial = username.charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ color: "#fff", fontSize: size * 0.5, fontWeight: 600 }}>{initial}</span>
    </div>
  );
}

function ProfilePic({ url, username, size }: { url?: string; username: string; size: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={username}
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
  return <DefaultAvatar username={username} size={size} />;
}

function VerifiedBadge({ platform }: { platform: string }) {
  const color = platform === "youtube" ? "#aaa" : "#20D5EC";
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="10" fill={color} />
      <path d="M8.5 13.5L5 10l1.4-1.4 2.1 2.1 4.6-4.6L14.5 7.5l-6 6z" fill="#fff" />
    </svg>
  );
}

function HeartIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function ThumbsUpIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  );
}

function TikTokComment({ data, scale }: { data: CommentOverlayData; scale: number }) {
  const s = (v: number) => Math.round(v * scale);
  const likes = formatLikesCount(data.likesCount);
  const time = data.timeAgo || "2h";

  return (
    <div
      style={{
        background: "rgba(37,37,37,0.92)",
        borderRadius: s(12),
        padding: `${s(14)}px ${s(16)}px`,
        display: "inline-flex",
        alignItems: "flex-start",
        gap: s(10),
        maxWidth: s(760),
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <ProfilePic url={data.profilePictureUrl} username={data.username} size={s(36)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: s(4) }}>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: s(13), fontWeight: 600 }}>
            {data.username}
          </span>
          {data.isVerified && <VerifiedBadge platform="tiktok" />}
        </div>
        <div style={{ color: "#fff", fontSize: s(15), marginTop: s(4), lineHeight: 1.35, wordWrap: "break-word" }}>
          {data.commentText}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: s(16), marginTop: s(6) }}>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: s(12) }}>{time}</span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: s(12) }}>Reply</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: s(2), marginLeft: s(8), flexShrink: 0 }}>
        <HeartIcon size={s(20)} color="rgba(255,255,255,0.5)" />
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: s(11) }}>{likes}</span>
      </div>
    </div>
  );
}

function YouTubeComment({ data, scale }: { data: CommentOverlayData; scale: number }) {
  const s = (v: number) => Math.round(v * scale);
  const likes = formatLikesCount(data.likesCount);
  const time = data.timeAgo || "2h ago";

  return (
    <div
      style={{
        background: "rgba(28,28,28,0.92)",
        borderRadius: s(12),
        padding: `${s(14)}px ${s(16)}px`,
        display: "inline-flex",
        alignItems: "flex-start",
        gap: s(12),
        maxWidth: s(760),
        fontFamily: "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <ProfilePic url={data.profilePictureUrl} username={data.username} size={s(36)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: s(6) }}>
          <span style={{ color: "#aaa", fontSize: s(13), fontWeight: 500 }}>
            @{data.username}
          </span>
          {data.isVerified && <VerifiedBadge platform="youtube" />}
          <span style={{ color: "#717171", fontSize: s(12) }}>{time}</span>
        </div>
        <div style={{ color: "#fff", fontSize: s(14), marginTop: s(4), lineHeight: 1.4, wordWrap: "break-word" }}>
          {data.commentText}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: s(4), marginTop: s(8) }}>
          <ThumbsUpIcon size={s(16)} color="#aaa" />
          <span style={{ color: "#aaa", fontSize: s(12) }}>{likes}</span>
        </div>
      </div>
    </div>
  );
}

function InstagramComment({ data, scale }: { data: CommentOverlayData; scale: number }) {
  const s = (v: number) => Math.round(v * scale);
  const likes = formatLikesCount(data.likesCount);

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.6)",
        borderRadius: s(20),
        padding: `${s(12)}px ${s(16)}px`,
        display: "inline-flex",
        alignItems: "center",
        gap: s(10),
        maxWidth: s(760),
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <ProfilePic url={data.profilePictureUrl} username={data.username} size={s(32)} />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
        <span style={{ color: "#fff", fontSize: s(13), fontWeight: 600 }}>
          {data.username}
        </span>
        {data.isVerified && (
          <span style={{ marginLeft: s(3), display: "inline-flex", verticalAlign: "middle" }}>
            <VerifiedBadge platform="instagram" />
          </span>
        )}
        <span style={{ color: "#fff", fontSize: s(13) }}>&nbsp;{data.commentText}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: s(1), marginLeft: s(8), flexShrink: 0 }}>
        <HeartIcon size={s(16)} color="rgba(255,255,255,0.7)" />
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: s(11) }}>{likes}</span>
      </div>
    </div>
  );
}

export function CommentPreview({ commentData, scale }: CommentPreviewProps) {
  switch (commentData.platform) {
    case "tiktok":
      return <TikTokComment data={commentData} scale={scale} />;
    case "youtube":
      return <YouTubeComment data={commentData} scale={scale} />;
    case "instagram":
      return <InstagramComment data={commentData} scale={scale} />;
    default:
      return <TikTokComment data={commentData} scale={scale} />;
  }
}
