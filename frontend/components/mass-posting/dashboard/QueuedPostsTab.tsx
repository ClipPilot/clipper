"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Chip,
  Pagination,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatDateTime } from "@/lib/formatters";
import { platformShortLabel, platformChipClass } from "@/lib/platformUtils";
import { MOCK_QUEUED_POSTS } from "./mockData";
import { FilterBar } from "./FilterBar";
import type { QueuedPostStatus } from "@/types/massPosting";

const STATUS_CONFIG: Record<
  QueuedPostStatus,
  { color: string; dotClass: string; icon?: string }
> = {
  queued: { color: "text-green-400", dotClass: "bg-green-400" },
  processing: { color: "text-blue-400", dotClass: "bg-blue-400" },
  failed: { color: "text-red-400", dotClass: "bg-red-400", icon: "solar:danger-triangle-bold" },
};

export function QueuedPostsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [dateRange, setDateRange] = useState("7days");
  const [page, setPage] = useState(1);
  const rowsPerPage = 5;

  const filtered = useMemo(() => {
    return MOCK_QUEUED_POSTS.filter((post) => {
      const matchesSearch =
        !searchQuery ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform =
        platformFilter === "all" ||
        post.platforms.includes(platformFilter as any);
      return matchesSearch && matchesPlatform;
    });
  }, [searchQuery, platformFilter]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const startItem = (page - 1) * rowsPerPage + 1;
  const endItem = Math.min(page * rowsPerPage, filtered.length);

  return (
    <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
        searchPlaceholder="Search by title..."
        showPlatformFilter
        platformValue={platformFilter}
        onPlatformChange={(v) => { setPlatformFilter(v); setPage(1); }}
        showDateRange
        dateRangeValue={dateRange}
        onDateRangeChange={setDateRange}
        countLabel={`${filtered.length} posts queued`}
      />

      <Table
        aria-label="Queued posts table"
        removeWrapper
        classNames={{
          th: "bg-surface-elevated text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4",
          td: "py-4 px-4 border-t border-border-base",
        }}
      >
        <TableHeader>
          <TableColumn>VIDEO CONTENT</TableColumn>
          <TableColumn>DATE SUBMITTED</TableColumn>
          <TableColumn>PLATFORMS</TableColumn>
          <TableColumn>STATUS</TableColumn>
          <TableColumn>ACTIONS</TableColumn>
        </TableHeader>
        <TableBody>
          {paginated.map((post) => {
            const { date, time } = formatDateTime(post.dateSubmitted);
            const statusCfg = STATUS_CONFIG[post.status];

            return (
              <TableRow
                key={post.id}
                className="hover:bg-surface-elevated/50 transition-colors"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative w-[72px] h-[48px] rounded-md overflow-hidden bg-surface-elevated flex-shrink-0">
                      <Avatar
                        src={post.thumbnailUrl}
                        radius="sm"
                        classNames={{
                          base: "w-full h-full",
                          img: "object-cover",
                        }}
                      />
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-medium px-1 rounded">
                        {post.duration}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate max-w-[280px]">
                        {post.title}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        ID: {post.id} &middot; {post.resolution}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm text-text-primary">{date}</p>
                    <p className="text-xs text-text-tertiary">{time}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {post.platforms.map((platform) => (
                      <span
                        key={platform}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${platformChipClass(platform)}`}
                      >
                        {platformShortLabel(platform)}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {statusCfg.icon ? (
                      <Icon
                        icon={statusCfg.icon}
                        width={14}
                        className={statusCfg.color}
                      />
                    ) : (
                      <span
                        className={`w-2 h-2 rounded-full ${statusCfg.dotClass}`}
                      />
                    )}
                    <span className={`text-sm font-medium capitalize ${statusCfg.color}`}>
                      {post.status}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button
                          size="sm"
                          variant="flat"
                          isIconOnly
                          className="bg-transparent hover:bg-surface-elevated"
                        >
                          <Icon
                            icon="solar:menu-dots-bold"
                            width={16}
                            className="text-text-secondary"
                          />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Post actions">
                        <DropdownItem
                          key="view"
                          startContent={
                            <Icon icon="solar:eye-bold" width={16} />
                          }
                        >
                          View Details
                        </DropdownItem>
                        <DropdownItem
                          key="edit"
                          startContent={
                            <Icon icon="solar:pen-bold" width={16} />
                          }
                        >
                          Edit
                        </DropdownItem>
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
                          startContent={
                            <Icon
                              icon="solar:trash-bin-trash-bold"
                              width={16}
                            />
                          }
                        >
                          Delete
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

      <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
        <p className="text-sm text-text-tertiary">
          Showing <span className="font-medium text-text-secondary">{startItem}-{endItem}</span> of{" "}
          <span className="font-medium text-text-secondary">{filtered.length}</span>
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
