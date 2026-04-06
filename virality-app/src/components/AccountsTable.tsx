"use client";

import { useState, useMemo } from "react";
import { Avatar, Button, Chip, Dropdown, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatNumber, platformIcon, platformIconColor } from "@clipper/shared-ui";

export interface AccountRow {
  id: number;
  username: string;
  displayName: string;
  platform: string;
  accountType: "profile" | "hashtag" | "keyword";
  competitorName: string;
  competitorId: number;
  views: number;
  avgViews: number;
  postCount: number;
  isActive: boolean;
  alertEnabled: boolean;
  syncStatus: "pending" | "syncing" | "completed" | "failed";
}

interface AccountsTableProps {
  accounts: AccountRow[];
  platformFilter?: string;
  searchQuery?: string;
}

export function AccountsTable({ accounts, platformFilter = "all", searchQuery }: AccountsTableProps) {
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const matchesPlatform = platformFilter === "all" || a.platform === platformFilter;
      const matchesSearch =
        !searchQuery ||
        a.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.competitorName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPlatform && matchesSearch;
    });
  }, [accounts, platformFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  if (accounts.length === 0) {
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
              {["ACCOUNT", "PLATFORM", "COMPETITOR", "VIEWS", "AVG VIEWS", "POSTS", "STATUS", "ALERTS", ""].map((h, i) => (
                <th key={i} className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">
                  {h === "STATUS" ? (
                    <div className="flex items-center gap-1">
                      STATUS
                      <Tooltip>
                        <Tooltip.Trigger>
                          <span className="cursor-help"><Icon icon="solar:info-circle-linear" width={13} className="text-text-tertiary" /></span>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Active accounts are synced and billed. Inactive accounts are skipped.</Tooltip.Content>
                      </Tooltip>
                    </div>
                  ) : h === "ALERTS" ? (
                    <div className="flex items-center gap-1">
                      ALERTS
                      <Tooltip>
                        <Tooltip.Trigger>
                          <span className="cursor-help"><Icon icon="solar:info-circle-linear" width={13} className="text-text-tertiary" /></span>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Receive email alerts when posts go viral.</Tooltip.Content>
                      </Tooltip>
                    </div>
                  ) : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((a) => (
              <tr key={a.id} className="cursor-pointer hover:bg-surface-hover transition-colors">
                <td className="py-2 px-3 border-t border-border-base text-xs">
                  <div className="flex items-center gap-3">
                    {a.accountType === "hashtag" ? (
                      <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center flex-shrink-0">
                        <Icon icon="solar:hashtag-bold-duotone" width={16} className="text-text-secondary" />
                      </div>
                    ) : a.accountType === "keyword" ? (
                      <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center flex-shrink-0">
                        <Icon icon="solar:magnifer-bold-duotone" width={16} className="text-text-secondary" />
                      </div>
                    ) : (
                      <Avatar size="sm" />
                    )}
                    <div>
                      <p className="font-medium text-text-primary">
                        {a.accountType === "hashtag" ? `#${a.username}` : `@${a.username}`}
                      </p>
                      <p className="text-xs text-text-tertiary truncate max-w-[180px]">
                        {a.accountType === "hashtag" ? "Hashtag search" : a.displayName}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-2 px-3 border-t border-border-base text-xs">
                  <Icon icon={platformIcon(a.platform)} width={20} className={platformIconColor(a.platform)} />
                </td>
                <td className="py-2 px-3 border-t border-border-base text-xs">
                  <span className="text-sm text-text-secondary">{a.competitorName}</span>
                </td>
                <td className="py-2 px-3 border-t border-border-base text-xs">
                  <span className="font-medium text-text-primary">{formatNumber(a.views)}</span>
                </td>
                <td className="py-2 px-3 border-t border-border-base text-xs">
                  <span className="font-medium text-text-primary">{formatNumber(a.avgViews)}</span>
                </td>
                <td className="py-2 px-3 border-t border-border-base text-xs">
                  <span className="font-medium text-text-primary">{formatNumber(a.postCount)}</span>
                </td>
                <td className="py-2 px-3 border-t border-border-base text-xs">
                  <Chip size="sm" variant="tertiary">
                    <span className="text-xs">{a.isActive ? "Active" : "Inactive"}</span>
                  </Chip>
                </td>
                <td className="py-2 px-3 border-t border-border-base text-xs" onClick={(e) => e.stopPropagation()}>
                  <Chip size="sm" variant="tertiary" className="cursor-pointer">
                    <span className="text-xs">{a.alertEnabled ? "On" : "Off"}</span>
                  </Chip>
                </td>
                <td className="py-2 px-3 border-t border-border-base text-xs" onClick={(e) => e.stopPropagation()}>
                  <Dropdown>
                    <Button isIconOnly size="sm" variant="ghost" className="!bg-transparent text-text-tertiary hover:text-text-primary">
                      <Icon icon="solar:menu-dots-bold-duotone" width={18} className="rotate-90" />
                    </Button>
                    <Dropdown.Popover>
                      <Dropdown.Menu aria-label="Account actions">
                        <Dropdown.Item key="toggle-alerts">
                          <Icon icon={a.alertEnabled ? "solar:bell-off-linear" : "solar:bell-bold-duotone"} width={16} />
                          {a.alertEnabled ? "Disable Alerts" : "Enable Alerts"}
                        </Dropdown.Item>
                        <Dropdown.Item key="toggle-status">
                          <Icon icon={a.isActive ? "solar:pause-circle-linear" : "solar:play-circle-linear"} width={16} />
                          {a.isActive ? "Set Inactive" : "Set Active"}
                        </Dropdown.Item>
                        <Dropdown.Item key="delete" className="text-danger">
                          <Icon icon="solar:trash-bin-trash-linear" width={16} />
                          Delete
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
        <p className="text-sm text-text-tertiary">
          Showing {paginated.length} of {filtered.length} Accounts
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              isDisabled={page <= 1}
              onPress={() => setPage(page - 1)}
              className="!bg-transparent text-text-tertiary"
            >
              <Icon icon="solar:alt-arrow-left-linear" width={16} />
            </Button>
            <span className="text-xs text-text-secondary px-2">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              isDisabled={page >= totalPages}
              onPress={() => setPage(page + 1)}
              className="!bg-transparent text-text-tertiary"
            >
              <Icon icon="solar:alt-arrow-right-linear" width={16} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
