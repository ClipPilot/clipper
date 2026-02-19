"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, Tab, Chip, Spinner } from "@heroui/react";
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

  // Initial load for both tabs
  useEffect(() => {
    fetchPosts("queued");
    fetchPosts("published");
  }, [fetchPosts]);

  const queuedCount = queuedPagination?.total ?? 0;

  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader />

        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as TabKey)}
          variant="underlined"
          classNames={{
            base: "w-full",
            tabList:
              "gap-6 px-0 py-0 w-full relative rounded-none border-b border-border-base",
            cursor: "w-full bg-accent-400",
            tab: "max-w-fit px-2 h-12",
            tabContent:
              "text-text-secondary group-data-[selected=true]:text-accent-400",
          }}
        >
          <Tab
            key="queued"
            title={
              <div className="flex items-center gap-2">
                <span>Queued Posts</span>
                {queuedCount > 0 && (
                  <Chip
                    size="sm"
                    variant="flat"
                    classNames={{
                      base: "bg-accent-400/10 text-accent-400 h-5 min-w-5",
                      content: "text-xs font-semibold px-1",
                    }}
                  >
                    {queuedCount}
                  </Chip>
                )}
              </div>
            }
          />
          <Tab key="accounts" title="Accounts" />
          <Tab key="published" title="Published Posts" />
        </Tabs>

        <div className="mt-6">
          {activeTab === "queued" && (
            <QueuedPostsTab
              posts={queuedPosts}
              pagination={queuedPagination}
              isLoading={queuedLoading}
              onParamsChange={(params) => fetchPosts("queued", params)}
            />
          )}
          {activeTab === "accounts" && <AccountsTab />}
          {activeTab === "published" && (
            <PublishedPostsTab
              posts={publishedPosts}
              pagination={publishedPagination}
              isLoading={publishedLoading}
              onParamsChange={(params) => fetchPosts("published", params)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
