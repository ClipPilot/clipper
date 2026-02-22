"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { adPostingAPI } from "@/api/adPosting";
import {
  platformIcon,
  platformChipClass,
  platformDisplayName,
} from "@/lib/platformUtils";
import { FilterBar } from "./FilterBar";
import { AccountStatCards } from "./AccountStatCards";
import type {
  MassPostingAccount,
  AccountStats,
} from "@/types/massPosting";

interface AccountsTabProps {
  dateRange: string;
  onDateRangeChange: (value: string) => void;
}

export function AccountsTab({ dateRange, onDateRangeChange }: AccountsTabProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [accounts, setAccounts] = useState<MassPostingAccount[]>([]);
  const [stats, setStats] = useState<AccountStats>({
    totalAccounts: 0,
    totalReposts: 0,
    avgPostsPerAccount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id) return;
    setIsLoading(true);
    try {
      const result = await adPostingAPI.getAccountStats(selectedTeam.id, {
        dateRange,
      });
      setAccounts(result.accounts);
      setStats(result.stats);
    } catch (err) {
      console.error("Failed to fetch account stats:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam?.id, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = searchQuery
    ? accounts.filter((a) =>
        a.handle.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : accounts;

  const renderAccountCard = (account: MassPostingAccount) => {
    return (
      <Card
        key={account.id}
        className="bg-surface-base border border-border-base"
      >
        <CardBody className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center">
              <Icon
                icon={platformIcon(account.platform)}
                width={20}
                className={platformChipClass(account.platform).split(" ")[1]}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary truncate">
                {account.handle}
              </p>
              <Chip
                size="sm"
                variant="flat"
                classNames={{
                  base: `${platformChipClass(account.platform)} h-5 px-1.5`,
                  content: "text-[10px] px-0.5",
                }}
              >
                {platformDisplayName(account.platform)}
              </Chip>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border-base">
            <span className="text-xs text-text-tertiary">Total Reposts</span>
            <span className="text-sm font-bold text-text-primary">
              {account.totalReposts}
            </span>
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <div>
      <AccountStatCards stats={stats} />

      <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search accounts..."
          showPlatformFilter={false}
          showDateRange
          dateRangeValue={dateRange}
          onDateRangeChange={onDateRangeChange}
          countLabel={
            filtered.length > 0
              ? `${filtered.length} account${filtered.length !== 1 ? "s" : ""}`
              : undefined
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" color="primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <div className="w-16 h-16 rounded-2xl bg-accent-400/10 flex items-center justify-center mb-4">
              <Icon
                icon="solar:users-group-rounded-bold-duotone"
                width={32}
                className="text-accent-400"
              />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              {searchQuery ? "No matching accounts" : "No accounts yet"}
            </h3>
            <p className="text-sm text-text-secondary max-w-sm text-center">
              {searchQuery
                ? "Try a different search term."
                : "Accounts will appear here once posts are published."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filtered.map((account) => renderAccountCard(account))}
          </div>
        )}
      </div>
    </div>
  );
}
