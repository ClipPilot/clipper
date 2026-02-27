"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { adminAPI, Campaign } from "@/lib/api";

export default function PublishPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminAPI.getCampaigns({
        status: "started",
        limit: 50,
      });
      setCampaigns(result.campaigns ?? []);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveCampaigns();
  }, [fetchActiveCampaigns]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Publish Videos
        </h1>
        <p className="text-text-secondary">
          Select an active campaign to manage and publish videos
        </p>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-text-secondary">
            Loading active campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center text-text-tertiary">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            No active campaigns. Campaigns must be in &quot;started&quot; status to publish.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                onClick={() =>
                  router.push(`/dashboard/campaigns/${campaign.id}/publish`)
                }
                className="px-6 py-5 flex items-center gap-6 hover:bg-surface-hover/50 transition-colors cursor-pointer"
              >
                {/* Campaign icon */}
                <div className="w-12 h-12 rounded-xl bg-emerald/10 border border-emerald/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-emerald"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-text-primary truncate">
                      {campaign.name}
                    </h3>
                    <span className="inline-block px-2 py-0.5 text-xs rounded-lg border bg-green-500/10 border-green-500/20 text-green-400 capitalize flex-shrink-0">
                      {campaign.status}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary mt-0.5">
                    {campaign.team_name} &middot; Team #{campaign.team_id}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 flex-shrink-0">
                  {campaign.budget && (
                    <div className="text-right">
                      <div className="text-xs text-text-tertiary">Budget</div>
                      <div className="text-sm font-semibold text-text-primary">
                        ${Number(campaign.budget).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {campaign.quoted_cpm && (
                    <div className="text-right">
                      <div className="text-xs text-text-tertiary">CPM</div>
                      <div className="text-sm font-semibold text-text-primary">
                        ${Number(campaign.quoted_cpm).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <svg
                  className="w-5 h-5 text-text-tertiary flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
