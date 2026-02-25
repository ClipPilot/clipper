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
  Button,
  Chip,
  Pagination,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { CompetitorWithAccounts, AccountPostStats, ViralityAccount } from "@/api/virality";
import { formatNumber } from "@/lib/formatters";
import { platformIcon, platformIconColor, type Platform } from "@/lib/platformUtils";

export type { Platform };

interface FlatAccount {
  account: ViralityAccount;
  competitorName: string;
  competitorId: number;
}

interface AccountsTableProps {
  competitors: CompetitorWithAccounts[];
  platformFilter: Platform | "all";
  searchQuery?: string;
  isLoading?: boolean;
  accountPostStats?: Record<number, AccountPostStats>;
  onViewCompetitor?: (competitorId: number) => void;
  onViewAccount?: (competitorId: number, accountId: number) => void;
  onDeleteAccount?: (accountId: number) => void;
  onToggleAccountStatus?: (accountId: number, newStatus: "active" | "inactive") => void;
  accountStatuses?: Record<number, "active" | "inactive">;
}

export function AccountsTable({
  competitors,
  platformFilter,
  searchQuery,
  isLoading,
  accountPostStats,
  onViewCompetitor,
  onViewAccount,
  onDeleteAccount,
  onToggleAccountStatus,
  accountStatuses,
}: AccountsTableProps) {
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Flatten competitors into individual account rows
  const flatAccounts = useMemo<FlatAccount[]>(() => {
    const result: FlatAccount[] = [];
    for (const c of competitors) {
      for (const a of c.accounts) {
        result.push({
          account: a,
          competitorName: c.name,
          competitorId: c.id,
        });
      }
    }
    return result;
  }, [competitors]);

  // Filter by platform and search query
  const filtered = useMemo(() => {
    return flatAccounts.filter((fa) => {
      const matchesPlatform =
        platformFilter === "all" || fa.account.platform === platformFilter;
      const matchesSearch =
        !searchQuery ||
        fa.account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fa.competitorName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPlatform && matchesSearch;
    });
  }, [flatAccounts, platformFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (flatAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Icon icon="solar:users-group-rounded-linear" width={48} className="text-text-tertiary" />
        <p className="text-text-secondary">No accounts tracked yet</p>
        <p className="text-text-tertiary text-sm">Add your first account to start tracking</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
      <Table
        aria-label="Tracked accounts table"
        removeWrapper
        classNames={{
          th: "bg-surface-elevated text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4 whitespace-nowrap",
          td: "py-4 px-4 border-t border-border-base",
          table: "min-w-[700px]",
        }}
      >
        <TableHeader>
          <TableColumn>ACCOUNT</TableColumn>
          <TableColumn>PLATFORM</TableColumn>
          <TableColumn>COMPETITOR</TableColumn>
          <TableColumn>VIEWS</TableColumn>
          <TableColumn>AVG VIEWS</TableColumn>
          <TableColumn>POSTS</TableColumn>
          <TableColumn>
            <div className="flex items-center gap-1">
              STATUS
              <Tooltip
                content="Active accounts are synced and billed 1 credit per account per week. Inactive accounts are skipped during sync and not billed."
                classNames={{ content: "max-w-[220px] text-xs m-2" }}
              >
                <span className="cursor-help">
                  <Icon icon="solar:info-circle-linear" width={13} className="text-text-tertiary" />
                </span>
              </Tooltip>
            </div>
          </TableColumn>
          <TableColumn className="w-10"> </TableColumn>
        </TableHeader>
        <TableBody>
          {paginated.map((fa) => {
            const stats = accountPostStats?.[fa.account.id];
            const views = stats?.totalViews || 0;
            const postCount = stats?.postCount || 0;
            const avgViews = postCount > 0 ? Math.round(views / postCount) : 0;
            return (
              <TableRow
                key={fa.account.id}
                className="cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() => onViewAccount?.(fa.competitorId, fa.account.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    {fa.account.account_type === "hashtag" ? (
                      <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center flex-shrink-0">
                        <Icon icon="solar:hashtag-bold" width={16} className="text-text-secondary" />
                      </div>
                    ) : fa.account.account_type === "keyword" ? (
                      <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center flex-shrink-0">
                        <Icon icon="solar:magnifer-bold" width={16} className="text-text-secondary" />
                      </div>
                    ) : (
                      <Avatar
                        src={fa.account.avatar_url || undefined}
                        name={fa.account.username.charAt(0).toUpperCase()}
                        size="sm"
                        classNames={{ base: "bg-surface-hover flex-shrink-0" }}
                      />
                    )}
                    <div>
                      <p className="font-medium text-text-primary">
                        {fa.account.account_type === "hashtag"
                          ? `#${fa.account.username}`
                          : fa.account.account_type === "keyword"
                            ? fa.account.username
                            : `@${fa.account.username}`}
                      </p>
                      <p className="text-xs text-text-tertiary truncate max-w-[180px]">
                        {fa.account.account_type === "hashtag"
                          ? "Hashtag search"
                          : fa.account.account_type === "keyword"
                            ? "Keyword search"
                            : fa.account.display_name || ""}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Icon
                    icon={platformIcon(fa.account.platform)}
                    width={20}
                    className={platformIconColor(fa.account.platform)}
                  />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-text-secondary">
                    {fa.competitorName}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-text-primary">
                    {formatNumber(views)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-text-primary">
                    {formatNumber(avgViews)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-text-primary">
                    {formatNumber(postCount)}
                  </span>
                </TableCell>
                <TableCell>
                  {(() => {
                    const status = accountStatuses?.[fa.account.id] ?? "active";
                    return (
                      <Chip
                        size="sm"
                        variant="flat"
                        classNames={{
                          base: status === "active"
                            ? "bg-green-500/10 text-green-500 h-6 px-2"
                            : "bg-default-100 text-text-tertiary h-6 px-2",
                        }}
                      >
                        <span className="text-xs">{status === "active" ? "Active" : "Inactive"}</span>
                      </Chip>
                    );
                  })()}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="text-text-tertiary data-[hover=true]:bg-surface-elevated data-[hover=true]:text-text-primary"
                      >
                        <Icon icon="solar:menu-dots-bold" width={18} className="rotate-90" />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="Account actions"
                      onAction={(key) => {
                        if (key === "delete") {
                          onDeleteAccount?.(fa.account.id);
                        } else if (key === "toggle-status") {
                          const current = accountStatuses?.[fa.account.id] ?? "active";
                          onToggleAccountStatus?.(fa.account.id, current === "active" ? "inactive" : "active");
                        }
                      }}
                    >
                      <DropdownItem
                        key="toggle-status"
                        startContent={
                          <Icon
                            icon={(accountStatuses?.[fa.account.id] ?? "active") === "active" ? "solar:pause-circle-linear" : "solar:play-circle-linear"}
                            width={16}
                          />
                        }
                      >
                        {(accountStatuses?.[fa.account.id] ?? "active") === "active" ? "Set Inactive" : "Set Active"}
                      </DropdownItem>
                      <DropdownItem
                        key="delete"
                        className="text-danger"
                        color="danger"
                        startContent={<Icon icon="solar:trash-bin-trash-linear" width={16} />}
                      >
                        Delete
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
        <p className="text-sm text-text-tertiary">
          Showing {paginated.length} of {filtered.length} Accounts
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
