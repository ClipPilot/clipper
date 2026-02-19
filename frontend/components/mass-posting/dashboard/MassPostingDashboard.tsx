"use client";

import { useState } from "react";
import { Tabs, Tab, Chip } from "@heroui/react";
import { DashboardHeader } from "./DashboardHeader";
import { QueuedPostsTab } from "./QueuedPostsTab";
import { AccountsTab } from "./AccountsTab";
import { PublishedPostsTab } from "./PublishedPostsTab";
import { MOCK_QUEUED_POSTS } from "./mockData";

type TabKey = "queued" | "accounts" | "published";

export function MassPostingDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("queued");

  const queuedCount = MOCK_QUEUED_POSTS.filter(
    (p) => p.status === "queued"
  ).length;

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
          {activeTab === "queued" && <QueuedPostsTab />}
          {activeTab === "accounts" && <AccountsTab />}
          {activeTab === "published" && <PublishedPostsTab />}
        </div>
      </div>
    </div>
  );
}
