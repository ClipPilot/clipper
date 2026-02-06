"use client";

import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ViralityPost } from "@/api/virality";

interface PostCardProps {
  post: ViralityPost;
}

export function PostCard({ post }: PostCardProps) {
  const formatNumber = (num: number | null | undefined) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Unknown date";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPostTypeIcon = () => {
    switch (post.post_type?.toLowerCase()) {
      case "video":
        return "solar:video-frame-bold";
      case "sidecar":
        return "solar:gallery-wide-bold";
      default:
        return "solar:gallery-bold";
    }
  };

  const getPostTypeLabel = () => {
    switch (post.post_type?.toLowerCase()) {
      case "video":
        return "Video";
      case "sidecar":
        return "Carousel";
      default:
        return "Image";
    }
  };

  const truncateCaption = (text: string | null, maxLength: number = 100) => {
    if (!text) return "No caption";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const openPost = () => {
    window.open(post.post_url, "_blank");
  };

  return (
    <Card
      className="bg-surface-base border border-border-base hover:border-accent-400/40 transition-all cursor-pointer"
      isPressable
      onPress={openPost}
    >
      <CardBody className="p-0">
        <div className="relative aspect-square bg-surface-elevated">
          {post.thumbnail_url ? (
            <img
              src={post.thumbnail_url}
              alt="Post thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon
                icon="solar:gallery-bold"
                width={48}
                className="text-text-tertiary"
              />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <Chip
              size="sm"
              variant="flat"
              startContent={<Icon icon={getPostTypeIcon()} width={12} />}
              classNames={{
                base: "bg-black/60 backdrop-blur-sm",
                content: "text-white text-xs",
              }}
            >
              {getPostTypeLabel()}
            </Chip>
          </div>
        </div>

        <div className="p-3">
          <p className="text-sm text-text-secondary line-clamp-2 mb-3">
            {truncateCaption(post.caption)}
          </p>

          <div className="flex items-center justify-between text-xs text-text-tertiary mb-2">
            <span>{formatDate(post.posted_at)}</span>
            {post.post_type?.toLowerCase() === "video" &&
              post.video_view_count && (
                <span className="flex items-center gap-1">
                  <Icon icon="solar:eye-bold" width={12} />
                  {formatNumber(post.video_view_count)} views
                </span>
              )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:heart-bold" className="text-red-500" width={16} />
              <span className="text-sm font-medium text-text-primary">
                {formatNumber(post.like_count)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon
                icon="solar:chat-round-dots-bold"
                className="text-blue-500"
                width={16}
              />
              <span className="text-sm font-medium text-text-primary">
                {formatNumber(post.comment_count)}
              </span>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
