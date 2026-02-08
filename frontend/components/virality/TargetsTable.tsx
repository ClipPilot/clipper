"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Chip,
  Button,
  Pagination,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { CompetitorWithTargets } from "@/api/virality";

export type Platform = "tiktok" | "instagram" | "x";

interface TargetsTableProps {
  competitors: CompetitorWithTargets[];
  platformFilter: Platform | "all";
  searchQuery?: string;
  isLoading?: boolean;
  onViewDetails?: (competitor: CompetitorWithTargets) => void;
  onSync?: (competitorId: number) => Promise<void>;
  onDelete?: (competitorId: number) => Promise<void>;
}

export function TargetsTable({
  competitors,
  platformFilter,
  searchQuery,
  isLoading,
  onViewDetails,
  onSync,
  onDelete,
}: TargetsTableProps) {
  const [page, setPage] = useState(1);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const rowsPerPage = 4;

  const formatNumber = (num: number) => {
    const abs = Math.abs(num);
    if (abs >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Filter competitors by platform and search query
  const filtered = competitors.filter((c) => {
    const matchesPlatform =
      platformFilter === "all" ||
      c.targets.some((t) => t.platform === platformFilter);
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.targets.some((t) =>
        t.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesPlatform && matchesSearch;
  });

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const getWorstSyncStatus = (targets: CompetitorWithTargets["targets"]) => {
    if (targets.some((t) => t.sync_status === "failed")) return "failed";
    if (targets.some((t) => t.sync_status === "syncing")) return "syncing";
    if (targets.some((t) => t.sync_status === "pending")) return "pending";
    if (targets.length === 0) return "pending";
    return "completed";
  };

  const getSyncChipColor = (status: string) => {
    switch (status) {
      case "completed": return "success";
      case "failed": return "danger";
      case "syncing": return "warning";
      default: return "default";
    }
  };

  const handleSync = async (competitorId: number) => {
    if (!onSync) return;
    setSyncingId(competitorId);
    try {
      await onSync(competitorId);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (competitorId: number) => {
    if (!onDelete) return;
    setDeletingId(competitorId);
    try {
      await onDelete(competitorId);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Icon icon="solar:users-group-rounded-linear" width={48} className="text-text-tertiary" />
        <p className="text-text-secondary">No competitors tracked yet</p>
        <p className="text-text-tertiary text-sm">Add your first competitor to start tracking</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
      <Table
        aria-label="Competitors table"
        removeWrapper
        classNames={{
          th: "bg-surface-elevated text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4",
          td: "py-4 px-4 border-t border-border-base",
        }}
      >
        <TableHeader>
          <TableColumn>COMPETITOR</TableColumn>
          <TableColumn>TARGETS</TableColumn>
          <TableColumn>FOLLOWERS</TableColumn>
          <TableColumn>POSTS</TableColumn>
          <TableColumn>SYNC STATUS</TableColumn>
          <TableColumn>ACTIONS</TableColumn>
        </TableHeader>
        <TableBody>
          {paginated.map((competitor) => {
            const totalFollowers = competitor.targets.reduce(
              (sum, t) => sum + (t.follower_count || 0),
              0
            );
            const totalPosts = competitor.targets.reduce(
              (sum, t) => sum + (t.post_count || 0),
              0
            );
            const syncStatus = getWorstSyncStatus(competitor.targets);
            const isSyncing = syncingId === competitor.id;
            const isDeleting = deletingId === competitor.id;

            return (
              <TableRow
                key={competitor.id}
                className="cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() => onViewDetails?.(competitor)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent-400/10">
                      <Icon
                        icon="solar:buildings-bold"
                        width={20}
                        className="text-accent-400"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">
                        {competitor.name}
                      </p>
                      {competitor.description && (
                        <p className="text-xs text-text-tertiary truncate max-w-[200px]">
                          {competitor.description}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {competitor.targets.length === 0 ? (
                      <span className="text-text-tertiary text-sm">No targets</span>
                    ) : (
                      competitor.targets.map((t) => (
                        <div key={t.id} className="flex items-center gap-1.5">
                          <Avatar
                            src={t.avatar_url || undefined}
                            name={t.username.charAt(0).toUpperCase()}
                            size="sm"
                            className="w-5 h-5"
                            classNames={{ base: "bg-surface-hover" }}
                          />
                          <span className="text-sm text-text-secondary">
                            @{t.username}
                          </span>
                          <Chip
                            size="sm"
                            variant="flat"
                            classNames={{ base: "bg-pink-500/10 text-pink-500 h-4 px-1" }}
                          >
                            <Icon icon="ri:instagram-fill" width={10} />
                          </Chip>
                        </div>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-text-primary">
                    {formatNumber(totalFollowers)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-text-primary">
                    {formatNumber(totalPosts)}
                  </span>
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={getSyncChipColor(isSyncing ? "syncing" : syncStatus)}
                  >
                    {isSyncing ? "Syncing..." : syncStatus}
                  </Chip>
                </TableCell>
                <TableCell>
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="sm"
                      variant="flat"
                      className="bg-surface-elevated"
                      onPress={() => onViewDetails?.(competitor)}
                    >
                      View Details
                    </Button>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button
                          size="sm"
                          variant="flat"
                          isIconOnly
                          className="bg-surface-elevated"
                        >
                          <Icon icon="solar:menu-dots-bold" width={16} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Competitor actions"
                        onAction={(key) => {
                          if (key === "sync") handleSync(competitor.id);
                          if (key === "delete") handleDelete(competitor.id);
                        }}
                      >
                        <DropdownItem
                          key="sync"
                          isDisabled={isSyncing}
                          startContent={
                            isSyncing ? (
                              <Spinner size="sm" />
                            ) : (
                              <Icon icon="solar:refresh-bold" width={16} />
                            )
                          }
                        >
                          {isSyncing ? "Syncing..." : "Sync All Targets"}
                        </DropdownItem>
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
                          isDisabled={isDeleting}
                          startContent={<Icon icon="solar:trash-bin-trash-bold" width={16} />}
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
        <p className="text-sm text-text-tertiary">
          Showing {paginated.length} of {filtered.length} Competitors
        </p>
        {totalPages > 1 && (
          <Pagination
            total={totalPages}
            page={page}
            onChange={setPage}
            size="sm"
            classNames={{
              item: "bg-surface-elevated text-text-secondary",
              cursor: "bg-accent-400 text-white",
            }}
          />
        )}
      </div>
    </div>
  );
}
