"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, Chip } from "@heroui/react";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { adPostingAPI, type GetTeamPostsParams } from "@/api/adPosting";
import type { TeamPost, PostsPagination } from "@/types/massPosting";
import { DashboardHeader } from "./DashboardHeader";
import { QueuedPostsTab } from "./QueuedPostsTab";
import { AccountsTab } from "./AccountsTab";
import { PublishedPostsTab } from "./PublishedPostsTab";

type TabKey = "queued" | "accounts" | "published";

export function MassPostingDashboard() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [activeTab, setActiveTab] = useState<TabKey>("queued");
  const [dateRange, setDateRange] = useState("mtd");

  // Queued state
  const [queuedPosts, setQueuedPosts] = useState<TeamPost[]>([]);
  const [queuedPagination, setQueuedPagination] = useState<PostsPagination | null>(null);
  const [queuedLoading, setQueuedLoading] = useState(false);

  // Published state
  const [publishedPosts, setPublishedPosts] = useState<TeamPost[]>([]);
  const [publishedPagination, setPublishedPagination] = useState<PostsPagination | null>(null);
  const [publishedLoading, setPublishedLoading] = useState(false);

  const fetchPosts = useCallback(
    async (tab: "queued" | "published", params: GetTeamPostsParams = {}) => {
      if (!selectedTeam?.id) return;
      const setLoading = tab === "queued" ? setQueuedLoading : setPublishedLoading;
      const setPosts = tab === "queued" ? setQueuedPosts : setPublishedPosts;
      const setPagination = tab === "queued" ? setQueuedPagination : setPublishedPagination;

      setLoading(true);
      try {
        const result = await adPostingAPI.getTeamPosts(selectedTeam.id, {
          tab,
          pageSize: 20,
          ...params,
        });
        setPosts(result.posts);
        setPagination(result.pagination);
      } catch (err) {
        console.error(`Failed to fetch ${tab} posts:`, err);
      } finally {
        setLoading(false);
      }
    },
    [selectedTeam?.id]
  );

  // Load queued posts on mount / team change
  useEffect(() => {
    fetchPosts("queued");
  }, [fetchPosts]);

  // Load published posts on mount / team change / dateRange change
  useEffect(() => {
    fetchPosts("published", { dateRange });
  }, [fetchPosts, dateRange]);

  const queuedCount = queuedPagination?.totalPosts ?? 0;

  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader />

        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as TabKey)}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Mass posting tabs">
              <Tabs.Tab id="queued">
                <div className="flex items-center gap-2">
                  <span>Queued Posts</span>
                  {queuedCount > 0 && (
                    <Chip size="sm" variant="tertiary">
                      {queuedCount}
                    </Chip>
                  )}
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="accounts">
                Accounts
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="published">
                Published Posts
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="queued">
            <div className="mt-6">
              <QueuedPostsTab
                posts={queuedPosts}
                pagination={queuedPagination}
                isLoading={queuedLoading}
                onParamsChange={(params) => fetchPosts("queued", params)}
              />
            </div>
          </Tabs.Panel>
          <Tabs.Panel id="accounts">
            <div className="mt-6">
              <AccountsTab
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
          </Tabs.Panel>
          <Tabs.Panel id="published">
            <div className="mt-6">
              <PublishedPostsTab
                posts={publishedPosts}
                pagination={publishedPagination}
                isLoading={publishedLoading}
                onParamsChange={(params) => fetchPosts("published", params)}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
          </Tabs.Panel>
        </Tabs>
      </div>
    </div>
  );
}
