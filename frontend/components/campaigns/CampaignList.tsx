"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { type Campaign } from "@/api/campaign";

function statusClasses(status: Campaign["status"]): string {
  switch (status) {
    case "pending":
    case "appeal":
      return "bg-yellow-500/15 text-yellow-500";
    case "accepted":
      return "bg-accent-400/15 text-accent-400";
    case "started":
      return "bg-green-500/15 text-green-500";
    case "paused":
      return "bg-orange-500/15 text-orange-500";
    case "completed":
      return "bg-blue-500/15 text-blue-500";
    case "rejected":
      return "bg-red-500/15 text-red-500";
    default:
      return "bg-white/[0.08] text-text-secondary";
  }
}

function statusLabel(status: Campaign["status"]): string {
  switch (status) {
    case "pending":
      return "Pending Review";
    case "accepted":
      return "Accepted";
    case "started":
      return "Active";
    case "paused":
      return "Paused";
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    case "appeal":
      return "Under Appeal";
    default:
      return status;
  }
}

type FilterTab = "all" | "live" | "review" | "done";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

const TAB_STATUSES: Record<FilterTab, Campaign["status"][] | null> = {
  all: null,
  live: ["started", "paused"],
  review: ["pending", "appeal"],
  done: ["completed", "rejected"],
};

function filterCampaigns(campaigns: Campaign[], tab: FilterTab): Campaign[] {
  const statuses = TAB_STATUSES[tab];
  if (!statuses) return campaigns;
  return campaigns.filter((c) => statuses.includes(c.status));
}

export function CampaignList() {
  const router = useRouter();
  const { campaigns, isLoading } = useCampaigns();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filtered = useMemo(
    () => filterCampaigns(campaigns, activeTab),
    [campaigns, activeTab]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { all: campaigns.length, live: 0, review: 0, done: 0 };
    for (const c of campaigns) {
      if (TAB_STATUSES.live!.includes(c.status)) counts.live++;
      if (TAB_STATUSES.review!.includes(c.status)) counts.review++;
      if (TAB_STATUSES.done!.includes(c.status)) counts.done++;
    }
    return counts;
  }, [campaigns]);

  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
              Campaigns
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Manage your ad campaigns and track their progress.
            </p>
          </div>
          <Button variant="primary"
 onPress={() => router.push("/dashboard/publish-posts/create")}
 >
            <Icon icon="solar:add-circle-bold" width={18} />
            New Campaign
          </Button>
        </div>

        {/* How it works */}
        <HowItWorks />

        {/* Filter chips */}
        {campaigns.length > 0 && (
          <div className="flex gap-2 mb-6">
            {FILTER_TABS.map((tab) => (
              <Button
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                variant="tertiary"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-accent-400/15 text-accent-400"
                    : "bg-surface-base text-text-secondary hover:bg-surface-elevated"
                }`}
              >
                {tab.label}
                {tabCounts[tab.key] > 0 && (
                  <span className={`ml-1.5 text-xs ${
                    activeTab === tab.key ? "text-accent-400/70" : "text-text-tertiary"
                  }`}>
                    {tabCounts[tab.key]}
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}

        {/* Campaign grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" color="accent" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
            <div className="flex flex-col items-center text-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-accent-400/10 flex items-center justify-center">
                <Icon
                  icon="solar:megaphone-bold-duotone"
                  className="text-accent-400"
                  width={32}
                />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-text-primary">
                  No campaigns yet
                </h3>
                <p className="text-sm text-text-secondary max-w-xs">
                  Create your first campaign to start reaching your audience
                  with targeted video ads.
                </p>
              </div>
              <Button variant="primary"
 onPress={() => router.push("/dashboard/publish-posts/create")}
 >
                <Icon icon="solar:add-circle-bold" width={18} />
                Create Campaign
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-2">
            <Icon
              icon="solar:filter-bold-duotone"
              className="text-text-tertiary"
              width={32}
            />
            <p className="text-sm text-text-secondary">
              No campaigns match this filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => router.push(`/dashboard/publish-posts/${campaign.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const HOW_IT_WORKS_ITEMS = [
  {
    key: "lifecycle",
    icon: "solar:restart-bold-duotone",
    title: "Campaign lifecycle",
    content:
      "After submitting your campaign for review, our team approves it and sets your CPM rate. Once approved, complete 3 setup steps — upload videos, fund your wallet, and sign the agreement — then start your campaign. We distribute your videos to creators who post them on their social accounts. You can pause or resume at any time.",
  },
  {
    key: "billing",
    icon: "solar:dollar-bold-duotone",
    title: "How billing works",
    content:
      "You're charged daily based on actual views your posts receive, using a CPM (cost per 1,000 views) model. Each day, we calculate the new views since the last billing cycle and charge your campaign wallet first. If the wallet balance isn't enough, the remainder is charged to your card on file. You'll never be charged for views that haven't happened yet.",
  },
  {
    key: "wallet",
    icon: "solar:wallet-bold-duotone",
    title: "Wallet & payments",
    content:
      "Your campaign wallet is pre-funded during setup. Daily charges draw from the wallet first, then your card covers any remainder. You can top up your wallet at any time. If both the wallet and card payment fail, the campaign is automatically paused and you'll receive an email notification. Just add funds or update your card to resume.",
  },
  {
    key: "tracking",
    icon: "solar:chart-bold-duotone",
    title: "View tracking",
    content:
      "Post metrics (views, plays) are synced every 12 hours from social platforms. Each post is tracked for 31 days after publishing. Only posts that have been successfully published are tracked and billed. You can see a full breakdown of views and charges per post in the Billing tab of each campaign.",
  },
];

function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6 rounded-xl border border-border-base bg-white/[0.02] overflow-hidden">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon icon="solar:info-circle-bold-duotone" width={18} className="text-accent-400" />
          <span className="text-sm font-medium text-text-primary">How campaigns work</span>
        </div>
        <Icon icon={open ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"} width={16} className="text-text-tertiary" />
      </div>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border-base pt-4">
          {HOW_IT_WORKS_ITEMS.map((item) => (
            <div key={item.key} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Icon icon={item.icon} width={15} className="text-accent-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-text-primary">{item.title}</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{item.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  onClick,
}: {
  campaign: Campaign;
  onClick: () => void;
}) {
  const budgetNum = campaign.budget ? parseFloat(campaign.budget) : null;
  const cpmNum = campaign.quoted_cpm ? parseFloat(campaign.quoted_cpm) : null;

  const budget =
    budgetNum != null
      ? `$${budgetNum.toLocaleString()}`
      : "No budget set";

  const cpm = cpmNum != null ? `$${cpmNum.toFixed(2)} CPM` : null;

  return (
    <div
      onClick={onClick}
      className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 rounded-xl border border-border-base bg-surface-base overflow-hidden hover:border-accent-400/50 transition-colors cursor-pointer h-full"
    >
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary truncate">
            {campaign.name}
          </p>
          <Chip size="sm" className={`flex-shrink-0 ${statusClasses(campaign.status)}`}>
            {statusLabel(campaign.status)}
          </Chip>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Budget</span>
            <span className="text-text-primary font-medium">{budget}</span>
          </div>
          {cpm && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">CPM</span>
              <span className="text-text-primary font-medium">{cpm}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-auto pt-1">
          <Icon
            icon="solar:arrow-right-line-duotone"
            className="text-text-tertiary ml-auto"
            width={14}
          />
          <span className="text-xs text-text-tertiary">View details</span>
        </div>
      </div>
    </div>
  );
}
