"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import {
  campaignAPI,
  type Campaign,
  type CpmBillingBreakdown,
  type CpmDailyCharge,
} from "@/api/campaign";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BillingTabProps {
  campaign: Campaign;
}

export function BillingTab({ campaign }: BillingTabProps) {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [billing, setBilling] = useState<CpmBillingBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBilling = useCallback(async () => {
    if (!selectedTeam?.id) return;
    setLoading(true);
    try {
      const data = await campaignAPI.getBillingBreakdown(
        selectedTeam.id,
        campaign.id,
      );
      setBilling(data);
    } catch (err) {
      console.error("Failed to fetch billing:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedTeam?.id, campaign.id]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!billing || billing.dailyCharges.length === 0) {
    return (
      <div className="py-20 text-center text-text-secondary">
        No billing data yet. Charges appear after the first metrics sync.
      </div>
    );
  }

  const { summary, dailyCharges } = billing;
  const cpmRate = summary.cpmRate ? parseFloat(summary.cpmRate) : 0;

  const chartData = [...dailyCharges]
    .reverse()
    .map((c) => ({
      date: new Date(c.chargeDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      views: c.totalViewsDelta,
      charge: c.chargeCents / 100,
      status: c.status,
    }));

  const summaryCards = [
    {
      title: "TOTAL CHARGED",
      value: `$${(summary.totalChargedCents / 100).toFixed(2)}`,
      icon: "solar:dollar-bold-duotone",
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-400/10",
    },
    {
      title: "TOTAL VIEWS",
      value: summary.totalViews.toLocaleString(),
      icon: "solar:eye-bold-duotone",
      iconColor: "text-blue-400",
      iconBg: "bg-blue-400/10",
    },
    {
      title: "FROM WALLET",
      value: `$${(summary.walletSpentCents / 100).toFixed(2)}`,
      icon: "solar:wallet-bold-duotone",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
    },
    {
      title: "FROM CARD",
      value: `$${(summary.cardChargedCents / 100).toFixed(2)}`,
      icon: "solar:card-bold-duotone",
      iconColor: "text-amber-400",
      iconBg: "bg-amber-400/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((stat) => (
          <Card
            key={stat.title}
            className="bg-surface-base border border-border-base"
          >
            <CardBody className="p-4">
              <p className="text-[11px] text-text-tertiary font-medium tracking-wide mb-2">
                {stat.title}
              </p>
              <div className="flex items-end justify-between gap-2">
                <p className="text-xl font-bold text-text-primary">
                  {stat.value}
                </p>
                <div
                  className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${stat.iconBg}`}
                >
                  <Icon icon={stat.icon} width={18} className={stat.iconColor} />
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-surface-base border border-border-base rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-primary">
            Daily Charges
          </h3>
          <span className="text-xs text-text-secondary">
            ${cpmRate.toFixed(2)} CPM
          </span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--heroui-default-200))"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(var(--heroui-default-500))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(var(--heroui-default-500))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--heroui-default-100))" }}
              contentStyle={{
                backgroundColor: "hsl(var(--heroui-content1))",
                border: "1px solid hsl(var(--heroui-default-200))",
                borderRadius: "8px",
                fontSize: "12px",
                padding: "8px 12px",
              }}
              formatter={(value, _name, props) => [
                `$${Number(value).toFixed(2)}`,
                `${(props as any).payload.views.toLocaleString()} views`,
              ]}
              labelFormatter={(label) => label}
            />
            <Bar
              dataKey="charge"
              fill="#6366F1"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily breakdown table */}
      <div className="bg-surface-base border border-border-base rounded-2xl overflow-hidden">
        <div className="px-6 py-3 border-b border-border-base flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            Billing History
          </span>
          <span className="text-xs text-text-secondary">
            {dailyCharges.length} day{dailyCharges.length !== 1 ? "s" : ""}
          </span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-elevated border-b border-border-base">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                New Views
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Charge
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-base">
            {dailyCharges.map((charge) => (
              <DailyChargeRow key={charge.id} charge={charge} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DailyChargeRow({ charge }: { charge: CpmDailyCharge }) {
  const [expanded, setExpanded] = useState(false);

  const statusStyles: Record<string, string> = {
    charged:
      "bg-success-500/10 border-success-500/20 text-success-500",
    failed: "bg-danger-500/10 border-danger-500/20 text-danger-500",
    waived:
      "bg-default-500/10 border-default-500/20 text-default-500",
  };

  const sourceLabel: Record<string, string> = {
    wallet: "Wallet",
    card: "Card",
  };

  return (
    <>
      <tr
        className="hover:bg-surface-elevated/50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-6 py-3">
          <div className="flex items-center gap-2">
            <Icon
              icon={
                expanded
                  ? "solar:alt-arrow-down-linear"
                  : "solar:alt-arrow-right-linear"
              }
              width={12}
              className="text-text-tertiary"
            />
            <span className="text-sm text-text-primary">
              {new Date(charge.chargeDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </td>
        <td className="px-6 py-3">
          <span className="text-sm text-text-secondary">
            {charge.totalViewsDelta.toLocaleString()}
          </span>
        </td>
        <td className="px-6 py-3">
          <span className="text-sm font-medium text-text-primary">
            ${(charge.chargeCents / 100).toFixed(2)}
          </span>
        </td>
        <td className="px-6 py-3">
          <span className="text-sm text-text-secondary">
            {charge.source ? sourceLabel[charge.source] || charge.source : "—"}
          </span>
        </td>
        <td className="px-6 py-3">
          <span
            className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg border ${statusStyles[charge.status] || statusStyles.waived}`}
          >
            {charge.status.charAt(0).toUpperCase() + charge.status.slice(1)}
          </span>
        </td>
      </tr>
      {expanded && charge.postBreakdown.length > 0 && (
        <tr>
          <td colSpan={5} className="px-6 py-0">
            <div className="ml-6 mb-3 mt-1 bg-surface-elevated rounded-lg border border-border-base overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-base">
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-text-tertiary uppercase">
                      Post ID
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-text-tertiary uppercase">
                      Prev Views
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-text-tertiary uppercase">
                      New Views
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-text-tertiary uppercase">
                      Delta
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-text-tertiary uppercase">
                      Charge
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-base">
                  {charge.postBreakdown.map((post) => (
                    <tr key={post.user_post_id}>
                      <td className="px-4 py-1.5 text-xs">
                        {post.post_url ? (
                          <a
                            href={post.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            #{post.user_post_id}
                          </a>
                        ) : (
                          <span className="text-text-secondary">#{post.user_post_id}</span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-text-secondary">
                        {post.previous_views.toLocaleString()}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-text-secondary">
                        {post.current_views.toLocaleString()}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-text-secondary">
                        +{post.delta_views.toLocaleString()}
                      </td>
                      <td className="px-4 py-1.5 text-xs font-medium text-text-primary">
                        ${(post.charge_cents / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
