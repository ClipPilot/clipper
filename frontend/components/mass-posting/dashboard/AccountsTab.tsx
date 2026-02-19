"use client";

import { useState, useMemo } from "react";
import { Button, Pagination } from "@heroui/react";
import { Icon } from "@iconify/react";
import { MOCK_ACCOUNTS } from "./mockData";
import { AccountStatCards } from "./AccountStatCards";
import { AccountGridCard } from "./AccountGridCard";
import { FilterBar } from "./FilterBar";

export function AccountsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30days");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const cardsPerPage = 8;

  const filtered = useMemo(() => {
    return MOCK_ACCOUNTS.filter((account) => {
      const matchesSearch =
        !searchQuery ||
        account.handle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform =
        platformFilter === "all" || account.platform === platformFilter;
      return matchesSearch && matchesPlatform;
    });
  }, [searchQuery, platformFilter]);

  const totalPages = Math.ceil(filtered.length / cardsPerPage);
  const paginated = filtered.slice(
    (page - 1) * cardsPerPage,
    page * cardsPerPage
  );

  const startItem = (page - 1) * cardsPerPage + 1;
  const endItem = Math.min(page * cardsPerPage, filtered.length);

  return (
    <div>
      <AccountStatCards />

      <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
          searchPlaceholder="Search accounts..."
          showPlatformFilter
          platformValue={platformFilter}
          onPlatformChange={(v) => { setPlatformFilter(v); setPage(1); }}
          showDateRange
          dateRangeValue={dateRange}
          onDateRangeChange={setDateRange}
          rightContent={
            <div className="flex items-center border border-border-base rounded-lg overflow-hidden">
              <button
                className={`p-2 transition-colors ${
                  viewMode === "grid"
                    ? "bg-surface-elevated text-text-primary"
                    : "bg-transparent text-text-tertiary hover:text-text-secondary"
                }`}
                onClick={() => setViewMode("grid")}
              >
                <Icon icon="solar:widget-bold" width={16} />
              </button>
              <button
                className={`p-2 transition-colors ${
                  viewMode === "list"
                    ? "bg-surface-elevated text-text-primary"
                    : "bg-transparent text-text-tertiary hover:text-text-secondary"
                }`}
                onClick={() => setViewMode("list")}
              >
                <Icon icon="solar:list-bold" width={16} />
              </button>
            </div>
          }
        />

        <div className="p-4">
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                : "grid grid-cols-1 gap-3"
            }
          >
            {paginated.map((account) => (
              <AccountGridCard key={account.id} account={account} />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
          <p className="text-sm text-text-tertiary">
            Showing <span className="font-medium text-text-secondary">{startItem}</span> to{" "}
            <span className="font-medium text-text-secondary">{endItem}</span> of{" "}
            <span className="font-medium text-text-secondary">{filtered.length}</span> Accounts
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="flat"
                className="bg-surface-elevated border border-border-base text-text-secondary"
                isDisabled={page === 1}
                onPress={() => setPage(page - 1)}
                startContent={<Icon icon="solar:arrow-left-linear" width={14} />}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="flat"
                className="bg-surface-elevated border border-border-base text-text-secondary"
                isDisabled={page === totalPages}
                onPress={() => setPage(page + 1)}
                endContent={<Icon icon="solar:arrow-right-linear" width={14} />}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
