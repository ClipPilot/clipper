"use client";

import { useState, useMemo } from "react";
import {
  Avatar,
  Button,
  Chip,
  Spinner,
  Dropdown,
  Tooltip } from "@heroui/react";
import { PaginationControl } from "@/components/ui/PaginationControl";
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
  onToggleAlert?: (accountId: number, enabled: boolean) => void;
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
  onToggleAlert,
  accountStatuses }: AccountsTableProps) {
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const flatAccounts = useMemo<FlatAccount[]>(() => {
    const result: FlatAccount[] = [];
    for (const c of competitors) {
      for (const a of c.accounts) {
        result.push({
          account: a,
          competitorName: c.name,
          competitorId: c.id });
      }
    }
    return result;
  }, [competitors]);

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
        <table className="w-full min-w-[700px]">
          <thead>
            <tr>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">ACCOUNT</th>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">PLATFORM</th>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">COMPETITOR</th>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">VIEWS</th>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">AVG VIEWS</th>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">POSTS</th>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">
                <div className="flex items-center gap-1">
                  STATUS
                  <Tooltip>
                    <Tooltip.Trigger>
                      <span className="cursor-help">
                        <Icon icon="solar:info-circle-linear" width={13} className="text-text-tertiary" />
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Active accounts are synced and billed 1 credit per account per week. Inactive accounts are skipped during sync and not billed.</Tooltip.Content>
                  </Tooltip>
                </div>
              </th>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">
                <div className="flex items-center gap-1">
                  ALERTS
                  <Tooltip>
                    <Tooltip.Trigger>
                      <span className="cursor-help">
                        <Icon icon="solar:info-circle-linear" width={13} className="text-text-tertiary" />
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Content>When enabled, you'll receive email alerts when this account's posts go viral based on your alert settings.</Tooltip.Content>
                  </Tooltip>
                </div>
              </th>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left w-10"> </th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((fa) => {
              const stats = accountPostStats?.[fa.account.id];
              const views = stats?.totalViews || 0;
              const postCount = stats?.postCount || 0;
              const avgViews = postCount > 0 ? Math.round(views / postCount) : 0;
              return (
                <tr
                  key={fa.account.id}
                  className="cursor-pointer hover:bg-surface-hover transition-colors"
                  onClick={() => onViewAccount?.(fa.competitorId, fa.account.id)}
                >
                  <td className="py-2 px-3 border-t border-border-base text-xs">
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
 size="sm"
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
                  </td>
                  <td className="py-2 px-3 border-t border-border-base text-xs">
                    <Icon
                      icon={platformIcon(fa.account.platform)}
                      width={20}
                      className={platformIconColor(fa.account.platform)}
                    />
                  </td>
                  <td className="py-2 px-3 border-t border-border-base text-xs">
                    <span className="text-sm text-text-secondary">
                      {fa.competitorName}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-t border-border-base text-xs">
                    <span className="font-medium text-text-primary">
                      {formatNumber(views)}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-t border-border-base text-xs">
                    <span className="font-medium text-text-primary">
                      {formatNumber(avgViews)}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-t border-border-base text-xs">
                    <span className="font-medium text-text-primary">
                      {formatNumber(postCount)}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-t border-border-base text-xs">
                    {(() => {
                      const status = accountStatuses?.[fa.account.id] ?? "active";
                      return (
                        <Chip
 size="sm"
 variant="tertiary"
 >
                          <span className="text-xs">{status === "active" ? "Active" : "Inactive"}</span>
                        </Chip>
                      );
                    })()}
                  </td>
                  <td className="py-2 px-3 border-t border-border-base text-xs" onClick={(e) => e.stopPropagation()}>
                    <Chip
 size="sm"
 variant="tertiary"
 className="cursor-pointer"
 onClick={() => onToggleAlert?.(fa.account.id, !fa.account.alert_enabled)}
 >
                      <span className="text-xs">{fa.account.alert_enabled ? "On" : "Off"}</span>
                    </Chip>
                  </td>
                  <td className="py-2 px-3 border-t border-border-base text-xs" onClick={(e) => e.stopPropagation()}>
                    <Dropdown>
                      <Button isIconOnly size="sm" variant="ghost" className="!bg-transparent text-text-tertiary hover:text-text-primary">
                          <Icon icon="solar:menu-dots-bold" width={18} className="rotate-90" />
                      </Button>
                      <Dropdown.Popover>

<Dropdown.Menu
                        aria-label="Account actions"
                        onAction={(key) => {
                          if (key === "delete") {
                            onDeleteAccount?.(fa.account.id);
                          } else if (key === "toggle-status") {
                            const current = accountStatuses?.[fa.account.id] ?? "active";
                            onToggleAccountStatus?.(fa.account.id, current === "active" ? "inactive" : "active");
                          } else if (key === "toggle-alerts") {
                            onToggleAlert?.(fa.account.id, !fa.account.alert_enabled);
                          }
                        }}
                      >
                        <Dropdown.Item
                          key="toggle-alerts"
                        >
                          <Icon
                            icon={fa.account.alert_enabled ? "solar:bell-off-linear" : "solar:bell-bold"}
                            width={16}
                          />
                          {fa.account.alert_enabled ? "Disable Alerts" : "Enable Alerts"}
                        </Dropdown.Item>
                        <Dropdown.Item
                          key="toggle-status"
                        >
                          <Icon
                            icon={(accountStatuses?.[fa.account.id] ?? "active") === "active" ? "solar:pause-circle-linear" : "solar:play-circle-linear"}
                            width={16}
                          />
                          {(accountStatuses?.[fa.account.id] ?? "active") === "active" ? "Set Inactive" : "Set Active"}
                        </Dropdown.Item>
                        <Dropdown.Item
                          key="delete"
                          className="text-danger"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" width={16} />
                          Delete
                        </Dropdown.Item>
                      </Dropdown.Menu>
</Dropdown.Popover>
                    </Dropdown>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
        <p className="text-sm text-text-tertiary">
          Showing {paginated.length} of {filtered.length} Accounts
        </p>
        {totalPages > 1 && (
          <PaginationControl total={totalPages}
 page={page}
 onChange={setPage}
 />
        )}
      </div>
    </div>
  );
}
