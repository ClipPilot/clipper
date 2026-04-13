"use client";

import { useState, useMemo } from "react";
import { Avatar, Button, Chip, Spinner, Dropdown, Tooltip, Label, Separator, Header } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatNumber } from "../lib/formatters";
import { platformIcon, platformIconColor } from "../lib/platformUtils";

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
}

export interface GroupOption {
  id: number;
  name: string;
}

interface AccountsTableProps {
  accounts: AccountRow[];
  platformFilter?: string;
  searchQuery?: string;
  isLoading?: boolean;
  accountLimit?: number;
  availableGroups?: GroupOption[];
  onToggleAlert?: (accountId: number, enabled: boolean) => void;
  onToggleStatus?: (accountId: number, newStatus: "active" | "inactive") => void;
  onActivateAll?: () => void;
  onDelete?: (accountId: number) => void;
  onMoveAccount?: (accountId: number, targetGroupId: number) => void;
  onRowClick?: (account: AccountRow) => void;
}

export function AccountsTable({
  accounts,
  platformFilter = "all",
  searchQuery,
  isLoading,
  accountLimit,
  onToggleAlert,
  onToggleStatus,
  onActivateAll,
  onDelete,
  onMoveAccount,
  availableGroups,
  onRowClick,
}: AccountsTableProps) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

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
    <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden flex flex-col">
      <div className="overflow-x-auto flex-1">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">ACCOUNT</th>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">PLATFORM</th>
              <th className="bg-surface-elevated text-text-tertiary text-[10px] font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-left">GROUP</th>
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
            {paginated.map((a) => (
              <tr
                key={a.id}
                className="cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() => onRowClick?.(a)}
              >
                <td className="py-2 px-3 border-t border-border-base text-xs">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-text-primary">
                        {a.accountType === "hashtag"
                          ? `#${a.username}`
                          : a.accountType === "keyword"
                            ? a.username
                            : `@${a.username}`}
                      </p>
                      <p className="text-xs text-text-tertiary truncate max-w-[180px]">
                        {a.accountType === "hashtag"
                          ? "Hashtag search"
                          : a.accountType === "keyword"
                            ? "Keyword search"
                            : a.displayName}
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
                <td className="py-2 px-3 border-t border-border-base text-xs" onClick={(e) => e.stopPropagation()}>
                  <Chip
                    size="sm"
                    variant="tertiary"
                    className="cursor-pointer"
                    onClick={() => {
                      console.log("[AccountsTable] status chip clicked:", a.id, "current:", a.isActive);
                      onToggleStatus?.(a.id, a.isActive ? "inactive" : "active");
                    }}
                  >
                    <span className={`text-xs ${a.isActive ? "text-green-500" : "text-text-tertiary"}`}>
                      {a.isActive ? "Active" : "Inactive"}
                    </span>
                  </Chip>
                </td>
                <td className="py-2 px-3 border-t border-border-base text-xs" onClick={(e) => e.stopPropagation()}>
                  <Chip
                    size="sm"
                    variant="tertiary"
                    className="cursor-pointer"
                    onClick={() => onToggleAlert?.(a.id, !a.alertEnabled)}
                  >
                    <span className="text-xs">{a.alertEnabled ? "On" : "Off"}</span>
                  </Chip>
                </td>
                <td className="py-2 px-3 border-t border-border-base text-xs">
                  <Dropdown>
                    <Button isIconOnly aria-label="Account actions" size="sm" variant="ghost" className="!bg-transparent text-text-tertiary hover:text-text-primary">
                      <Icon icon="solar:menu-dots-bold" width={18} className="rotate-90" />
                    </Button>
                    <Dropdown.Popover>
                      <Dropdown.Menu
                        aria-label="Account actions"
                        onAction={(key) => {
                          const k = String(key);
                          if (k === "toggle-alerts") onToggleAlert?.(a.id, !a.alertEnabled);
                          else if (k === "toggle-status") onToggleStatus?.(a.id, a.isActive ? "inactive" : "active");
                          else if (k === "delete") onDelete?.(a.id);
                          else if (k.startsWith("move-")) onMoveAccount?.(a.id, Number(k.replace("move-", "")));
                        }}
                      >
                        <Dropdown.Item id="toggle-alerts" textValue={a.alertEnabled ? "Disable Alerts" : "Enable Alerts"}>
                          <Icon icon={a.alertEnabled ? "solar:bell-off-linear" : "solar:bell-bold"} width={16} />
                          <Label>{a.alertEnabled ? "Disable Alerts" : "Enable Alerts"}</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="toggle-status" textValue={a.isActive ? "Set Inactive" : "Set Active"}>
                          <Icon icon={a.isActive ? "solar:pause-circle-linear" : "solar:play-circle-linear"} width={16} />
                          <Label>{a.isActive ? "Set Inactive" : "Set Active"}</Label>
                        </Dropdown.Item>
                        {availableGroups && availableGroups.filter((g) => g.id !== a.competitorId).length > 0 && (
                          <>
                            <Separator />
                            <Dropdown.Section>
                              <Header>Move to</Header>
                              {availableGroups
                                .filter((g) => g.id !== a.competitorId)
                                .map((g) => (
                                  <Dropdown.Item key={`move-${g.id}`} id={`move-${g.id}`} textValue={`Move to ${g.name}`}>
                                    <Icon icon="solar:transfer-horizontal-linear" width={16} />
                                    <Label>{g.name}</Label>
                                  </Dropdown.Item>
                                ))}
                            </Dropdown.Section>
                          </>
                        )}
                        <Separator />
                        <Dropdown.Item id="delete" textValue="Delete" variant="danger">
                          <Icon icon="solar:trash-bin-trash-linear" width={16} />
                          <Label>Delete</Label>
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
        <div className="flex items-center gap-3">
          <p className="text-sm text-text-tertiary">
            Showing {paginated.length} of {filtered.length} Accounts
          </p>
          {onActivateAll && accounts.some((a) => !a.isActive) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-accent-400"
              onPress={onActivateAll}
            >
              <Icon icon="solar:play-circle-bold" width={14} />
              Activate All
            </Button>
          )}
        </div>
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
