"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { type Campaign } from "@/api/campaign";

// ── Status helpers ───────────────────────────────────────────────────────────

function statusColor(
  status: Campaign["status"]
): "default" | "warning" | "success" | "danger" | "primary" | "secondary" {
  switch (status) {
    case "pending":
    case "appeal":
      return "warning";
    case "accepted":
      return "primary";
    case "started":
      return "success";
    case "paused":
      return "warning";
    case "completed":
      return "secondary";
    case "rejected":
      return "danger";
    default:
      return "default";
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

// ── Filter tab definitions ───────────────────────────────────────────────────

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

// TODO(human): Implement the filterCampaigns function
function filterCampaigns(campaigns: Campaign[], tab: FilterTab): Campaign[] {
  const statuses = TAB_STATUSES[tab];
  if (!statuses) return campaigns;
  return campaigns.filter((c) => statuses.includes(c.status));
}

// ── Main component ───────────────────────────────────────────────────────────

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
          <Button
            color="primary"
            onPress={() => router.push("/dashboard/publish-posts/create")}
            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
          >
            New Campaign
          </Button>
        </div>

        {/* Filter chips */}
        {campaigns.length > 0 && (
          <div className="flex gap-2 mb-6">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
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
              </button>
            ))}
          </div>
        )}

        {/* Campaign grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" color="primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="bg-surface-base border border-border-base">
            <CardBody className="flex flex-col items-center text-center py-20 gap-4">
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
              <Button
                color="primary"
                onPress={() => router.push("/dashboard/publish-posts/create")}
                startContent={<Icon icon="solar:add-circle-bold" width={18} />}
              >
                Create Campaign
              </Button>
            </CardBody>
          </Card>
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

// ── Campaign card ────────────────────────────────────────────────────────────

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
    <button
      onClick={onClick}
      className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 rounded-xl"
    >
      <Card className="bg-surface-base border border-border-base hover:border-accent-400/50 transition-colors cursor-pointer h-full">
        <CardBody className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-text-primary truncate">
              {campaign.name}
            </p>
            <Chip
              color={statusColor(campaign.status)}
              variant="flat"
              size="sm"
              className="flex-shrink-0"
            >
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
        </CardBody>
      </Card>
    </button>
  );
}
