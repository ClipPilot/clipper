"use client";

import { useMemo, useCallback, useEffect } from "react";
import {
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Tooltip,
  Chip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { CampaignVideo } from "@/api/campaign";

export const ROWS_PER_PAGE = 10;

const VIDEO_COLUMNS = [
  { uid: "thumbnail", name: "" },
  { uid: "title", name: "Title" },
  { uid: "source", name: "Source" },
  { uid: "added", name: "Added" },
  { uid: "actions", name: "" },
] as const;

export interface VideoTableProps {
  videos: CampaignVideo[];
  page: number;
  onPageChange: (page: number) => void;
  onPreview: (video: CampaignVideo) => void;
  onRemove: (videoId: number) => void;
  removingId: number | null;
}

export function VideoTable({
  videos,
  page,
  onPageChange,
  onPreview,
  onRemove,
  removingId,
}: VideoTableProps) {
  const totalPages = Math.ceil(videos.length / ROWS_PER_PAGE) || 1;

  const pageItems = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return videos.slice(start, start + ROWS_PER_PAGE);
  }, [videos, page]);

  // Reset to page 1 if current page exceeds total after removal
  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
  }, [page, totalPages, onPageChange]);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateString));
  };

  const renderCell = useCallback(
    (video: CampaignVideo, columnKey: string) => {
      switch (columnKey) {
        case "thumbnail":
          return (
            <div className="w-10 h-10 rounded-lg bg-default-100 flex items-center justify-center flex-shrink-0 overflow-hidden relative cursor-pointer">
              {video.presigned_url ? (
                <>
                  <video
                    src={video.presigned_url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Icon
                      icon="solar:play-bold"
                      className="text-white"
                      width={12}
                    />
                  </div>
                </>
              ) : (
                <Icon
                  icon="solar:video-library-bold-duotone"
                  className="text-text-tertiary"
                  width={16}
                />
              )}
            </div>
          );
        case "title":
          return (
            <p className="text-sm text-text-accent truncate max-w-[200px]">
              {video.title ?? video.file_name ?? `Video #${video.id}`}
            </p>
          );
        case "source":
          return video.clip_id ? (
            <Chip
 size="sm"
 variant="tertiary"
 className="bg-accent-400/10 text-accent-400"
 >
              <Icon icon="solar:library-bold-duotone" width={12} className="ml-1" />
              Library
            </Chip>
          ) : (
            <Chip
 size="sm"
 variant="tertiary"
 className="bg-warning-500/10 text-warning-600"
 >
              <Icon icon="solar:upload-bold-duotone" width={12} className="ml-1" />
              Upload
            </Chip>
          );
        case "added":
          return (
            <span className="text-xs text-text-secondary whitespace-nowrap">
              {formatDate(video.created_at)}
            </span>
          );
        case "actions":
          return (
            <div className="flex items-center justify-end gap-1">
              <Tooltip content="Preview">
                <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 onPress={() => onPreview(video)}
 aria-label="Preview video"
 >
                  <Icon
                    icon="solar:eye-bold"
                    className="text-text-secondary"
                    width={16}
                  />
                </Button>
              </Tooltip>
              <Tooltip content="Remove">
                <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 className="text-danger-500"
 onPress={() => onRemove(video.id)}
 isPending={removingId === video.id}
 aria-label="Remove video"
 >
                  <Icon icon="solar:trash-bin-trash-bold" width={16} />
                </Button>
              </Tooltip>
            </div>
          );
        default:
          return null;
      }
    },
    [onPreview, onRemove, removingId],
  );

  const bottomContent = useMemo(() => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-sm text-text-tertiary">
          {videos.length} video{videos.length !== 1 ? "s" : ""} total
        </span>
        <Pagination
 isCompact
 showControls
 showShadow
 page={page}
 total={totalPages}
 onChange={onPageChange}
 />
      </div>
    );
  }, [page, totalPages, videos.length, onPageChange]);

  return (
    <Table
      aria-label="Campaign videos"
      bottomContent={bottomContent}
      bottomContentPlacement="outside"
      classNames={{
        wrapper: "bg-surface-base border border-border-base shadow-none",
        th: "bg-surface-elevated text-text-secondary text-xs uppercase",
        td: "py-2",
        tr: "hover:bg-surface-elevated/50 cursor-pointer transition-colors",
      }}
      onRowAction={(key) => {
        const video = videos.find((v) => v.id === Number(key));
        if (video) onPreview(video);
      }}
    >
      <TableHeader columns={[...VIDEO_COLUMNS]}>
        {(column) => (
          <TableColumn
            key={column.uid}
            align={column.uid === "actions" ? "end" : "start"}
            width={
              column.uid === "thumbnail"
                ? 56
                : column.uid === "actions"
                  ? 100
                  : undefined
            }
          >
            {column.name}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody items={pageItems} emptyContent="No videos added yet">
        {(video) => (
          <TableRow key={video.id}>
            {(columnKey) => (
              <TableCell>{renderCell(video, columnKey as string)}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
