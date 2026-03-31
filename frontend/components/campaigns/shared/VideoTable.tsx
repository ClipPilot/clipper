"use client";

import { useMemo, useEffect } from "react";
import { Button, Chip, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { CampaignVideo } from "@/api/campaign";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

export const ROWS_PER_PAGE = 10;

const COLUMNS: DataTableColumn[] = [
  { id: "thumbnail", label: "", width: "56px" },
  { id: "title", label: "Title" },
  { id: "source", label: "Source" },
  { id: "added", label: "Added" },
  { id: "actions", label: "", align: "end", width: "100px" },
];

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

  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
  }, [page, totalPages, onPageChange]);

  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateString));

  const renderCell = (video: CampaignVideo, columnId: string) => {
    switch (columnId) {
      case "thumbnail":
        return (
          <div
            className="w-12 h-12 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0 overflow-hidden relative cursor-pointer group"
            onClick={() => onPreview(video)}
          >
            {video.presigned_url ? (
              <>
                <video src={video.presigned_url} className="w-full h-full object-cover" muted preload="metadata" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon icon="solar:play-bold" className="text-white" width={14} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-accent-400/10">
                <Icon icon="solar:play-bold" className="text-accent-400" width={14} />
              </div>
            )}
          </div>
        );
      case "title":
        return (
          <p className="text-sm text-text-primary truncate max-w-[200px]">
            {video.title ?? video.file_name ?? `Video #${video.id}`}
          </p>
        );
      case "source":
        return video.clip_id ? (
          <Chip size="sm" className="bg-accent-400/10 text-accent-400">
            <Icon icon="solar:library-bold-duotone" width={12} />
            Library
          </Chip>
        ) : (
          <Chip size="sm" className="bg-yellow-500/10 text-yellow-500">
            <Icon icon="solar:upload-bold-duotone" width={12} />
            Upload
          </Chip>
        );
      case "added":
        return <span className="text-xs text-text-secondary whitespace-nowrap">{formatDate(video.created_at)}</span>;
      case "actions":
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <Tooltip.Trigger>
                <Button isIconOnly size="sm" variant="tertiary" onPress={() => onPreview(video)} aria-label="Preview video">
                  <Icon icon="solar:eye-bold" className="text-text-secondary" width={16} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>Preview</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger>
                <Button isIconOnly size="sm" variant="tertiary" className="text-red-500" onPress={() => onRemove(video.id)} isPending={removingId === video.id} aria-label="Remove video">
                  <Icon icon="solar:trash-bin-trash-bold" width={16} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>Remove</Tooltip.Content>
            </Tooltip>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <DataTable
      columns={COLUMNS}
      rows={pageItems}
      getKey={(v) => v.id}
      renderCell={renderCell}
      onRowClick={onPreview}
      emptyContent="No videos added yet"
      page={page}
      totalPages={totalPages}
      totalItems={videos.length}
      onPageChange={onPageChange}
      ariaLabel="Campaign videos"
    />
  );
}
