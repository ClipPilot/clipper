"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button, Chip, Dropdown } from "@heroui/react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  Label,
} from "recharts";
import { toast } from "@/lib/toast";
import { PageLoader } from "@/components/ui/PageLoader";
import {
  DateRangeFilter,
  SegmentedControl,
  ViralityUpgradeWall,
  formatNumber,
  platformIcon,
  platformIconColor,
  type ViralityPost,
  type ViralityAccount,
} from "@clipper/shared-ui";
import { useTeams } from "@/hooks/useTeams";
import { useViralityDateRange } from "@/contexts/ViralityContext";
import { viralityAPI, type CompetitorWithAccounts } from "@/api/virality";
import { userPerformanceAPI } from "@/api/userPerformance";
import { canAccessViralityTracker } from "@/lib/plans";
import {
  aggregateByPlatform,
  aggregateByPostType,
  aggregateTotals,
  rowsToCsv,
  type ReportRow,
} from "./aggregations";

type Scope = "own" | "competitors";
type ReportTab = "platform" | "content" | "geographic";

const SCOPE_OPTIONS = [
  { value: "own" as const, label: "Your Performance" },
  { value: "competitors" as const, label: "Your Competitors" },
];

const TAB_OPTIONS: { value: ReportTab; label: string; icon: string }[] = [
  { value: "platform", label: "Platform Breakdown", icon: "solar:devices-bold-duotone" },
  { value: "content", label: "Content Type", icon: "solar:videocamera-record-bold-duotone" },
  { value: "geographic", label: "Geographic", icon: "solar:map-point-bold-duotone" },
];

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { selectedTeam } = useTeams();
  const { dateRange, setDateRange } = useViralityDateRange();

  const [scope, setScope] = useState<Scope>("own");
  const [tab, setTab] = useState<ReportTab>("platform");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(
    new Set(),
  );

  const [groups, setGroups] = useState<CompetitorWithAccounts[]>([]);
  const [accountsById, setAccountsById] = useState<Record<number, ViralityAccount>>({});
  const [posts, setPosts] = useState<ViralityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  const hasAccess = selectedTeam
    ? canAccessViralityTracker(selectedTeam.plan)
    : false;

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id || !hasAccess) return;
    const { startDate, endDate } = dateRange;

    setIsLoading(true);
    try {
      const allGroups = await viralityAPI.getGroupsWithAccounts(selectedTeam.id);
      const scopedGroups = allGroups.filter((g: any) =>
        scope === "competitors" ? g.competitor === true : g.competitor === false,
      );

      const scopedAccountIds = new Set<number>();
      const accountMap: Record<number, ViralityAccount> = {};
      for (const g of scopedGroups) {
        for (const a of g.accounts) {
          scopedAccountIds.add(a.id);
          accountMap[a.id] = a;
        }
      }

      setGroups(scopedGroups);
      setAccountsById(accountMap);

      const byAccount =
        scope === "competitors"
          ? await viralityAPI.getAllPosts(selectedTeam.id, startDate, endDate)
          : await userPerformanceAPI.getAllPosts(
              selectedTeam.id,
              startDate,
              endDate,
            );

      const flat: ViralityPost[] = [];
      for (const [idStr, arr] of Object.entries(byAccount)) {
        const accountId = Number(idStr);
        if (!scopedAccountIds.has(accountId)) continue;
        for (const p of arr) flat.push(p);
      }
      setPosts(flat);

      setSelectedGroupIds((prev) => {
        const next = new Set<number>();
        Array.from(prev).forEach((id) => {
          if (scopedGroups.some((g) => g.id === id)) next.add(id);
        });
        return next;
      });
    } catch (err: any) {
      toast({
        title: "Failed to load report data",
        description: err.message,
        color: "danger",
      });
    } finally {
      setIsLoading(false);
      setInitialLoad(false);
    }
  }, [selectedTeam?.id, hasAccess, dateRange, scope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPosts = useMemo(() => {
    if (selectedGroupIds.size === 0) return posts;
    const allowedAccountIds = new Set<number>();
    for (const g of groups) {
      if (selectedGroupIds.has(g.id)) {
        for (const a of g.accounts) allowedAccountIds.add(a.id);
      }
    }
    return posts.filter((p) => allowedAccountIds.has(p.account_id));
  }, [posts, groups, selectedGroupIds]);

  const platformRows = useMemo(
    () => aggregateByPlatform(filteredPosts, accountsById),
    [filteredPosts, accountsById],
  );
  const contentRows = useMemo(
    () => aggregateByPostType(filteredPosts),
    [filteredPosts],
  );
  const totals = useMemo(() => aggregateTotals(filteredPosts), [filteredPosts]);

  const currentRows: ReportRow[] =
    tab === "platform" ? platformRows : tab === "content" ? contentRows : [];

  const dimensionLabel = tab === "platform" ? "Platform" : "Content Type";

  const handleExportCsv = () => {
    if (tab === "geographic" || currentRows.length === 0) {
      toast({ title: "Nothing to export", color: "warning" });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const csv = rowsToCsv(currentRows, dimensionLabel);
    downloadCsv(`reports-${scope}-${tab}-${today}.csv`, csv);
  };

  const handleExportPdf = async () => {
    if (tab === "geographic" || currentRows.length === 0) {
      toast({ title: "Nothing to export", color: "warning" });
      return;
    }
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const scopeTitle =
        scope === "own" ? "Your Performance" : "Your Competitors";
      const tabTitle =
        tab === "platform" ? "Platform Breakdown" : "Content Type";

      const fmtDate = (iso?: string) =>
        iso ? new Date(iso).toLocaleDateString() : "—";
      const dateLabel = `${fmtDate(dateRange.startDate)} to ${fmtDate(dateRange.endDate)}`;

      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(`Report — ${tabTitle}`, margin, 56);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(scopeTitle, margin, 74);

      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(`Date range: ${dateLabel}`, margin, 92);
      doc.text(
        `Generated: ${new Date().toLocaleString()}`,
        pageWidth - margin,
        92,
        { align: "right" },
      );
      doc.setTextColor(0);

      autoTable(doc, {
        startY: 108,
        head: [["Metric", "Value"]],
        body: [
          ["Posts", totals.postCount.toLocaleString()],
          ["Views", totals.views.toLocaleString()],
          ["Likes", totals.likes.toLocaleString()],
          ["Comments", totals.comments.toLocaleString()],
          ["Engagement rate", `${totals.engRate.toFixed(2)}%`],
        ],
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 10,
          textColor: 0,
          lineColor: 0,
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
        },
        columnStyles: { 1: { halign: "right" } },
        margin: { left: margin, right: margin },
      });

      const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
      const afterSummaryY = (lastTable?.finalY ?? 108) + 24;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Breakdown by ${dimensionLabel}`, margin, afterSummaryY);

      autoTable(doc, {
        startY: afterSummaryY + 8,
        head: [
          [
            dimensionLabel,
            "Posts",
            "Views",
            "Likes",
            "Comments",
            "Eng. rate",
          ],
        ],
        body: currentRows.map((r) => [
          r.label,
          r.postCount.toLocaleString(),
          r.views.toLocaleString(),
          r.likes.toLocaleString(),
          r.comments.toLocaleString(),
          `${r.engRate.toFixed(2)}%`,
        ]),
        foot: [
          [
            "Total",
            totals.postCount.toLocaleString(),
            totals.views.toLocaleString(),
            totals.likes.toLocaleString(),
            totals.comments.toLocaleString(),
            `${totals.engRate.toFixed(2)}%`,
          ],
        ],
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 10,
          textColor: 0,
          lineColor: 0,
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
        },
        footStyles: {
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
        },
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
        margin: { left: margin, right: margin },
      });

      const today = new Date().toISOString().slice(0, 10);
      doc.save(`reports-${scope}-${tab}-${today}.pdf`);
    } catch (err: any) {
      toast({
        title: "Failed to export PDF",
        description: err?.message ?? "Unknown error",
        color: "danger",
      });
    }
  };

  const handleGroupSelection = (keys: Set<string>) => {
    const next = new Set<number>();
    Array.from(keys).forEach((k) => next.add(Number(k)));
    setSelectedGroupIds(next);
  };

  if (!selectedTeam) return <PageLoader />;
  if (!canAccessViralityTracker(selectedTeam.plan)) return <ViralityUpgradeWall />;
  if (initialLoad && isLoading) return <PageLoader />;

  const scopeLabel =
    scope === "own" ? "your tracked accounts" : "your tracked competitors";

  return (
    <div className="reports-page-root relative max-w-6xl mx-auto px-6 py-8 space-y-5">
      <div
        aria-hidden="true"
        className="reports-print-bg pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full bg-accent-400/25 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-sky-500/20 blur-[140px]" />
        <div className="absolute bottom-0 left-1/4 h-[28rem] w-[28rem] rounded-full bg-violet-500/20 blur-[140px]" />
        <div className="absolute top-10 right-1/4 h-64 w-64 rounded-full bg-emerald-500/15 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <p className="text-[28px] font-semibold tracking-tight text-text-primary">
            Reports
          </p>
          <p className="text-[13px] text-text-tertiary mt-1">
            Aggregated performance across {scopeLabel}
          </p>
        </div>
        <div className="reports-print-hide flex items-center gap-2">
          <Button
            size="sm"
            variant="tertiary"
            onPress={handleExportCsv}
            className="bg-white/[0.06] border border-white/[0.08] text-text-primary hover:bg-white/[0.10]"
          >
            <Icon icon="solar:document-text-bold-duotone" width={16} />
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onPress={handleExportPdf}
            className="bg-white/[0.06] border border-white/[0.08] text-text-primary hover:bg-white/[0.10]"
          >
            <Icon icon="solar:printer-bold-duotone" width={16} />
            Export PDF
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="reports-card reports-print-hide relative z-10 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
      >
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={setScope}
          />
          <div className="h-6 w-px bg-white/[0.06] hidden md:block" />
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <div className="h-6 w-px bg-white/[0.06] hidden md:block" />
          <Dropdown>
            <Button
              size="sm"
              variant="tertiary"
              className="bg-white/[0.04] border border-white/[0.08] text-text-primary hover:bg-white/[0.10]"
            >
              <Icon icon="solar:folder-bold-duotone" width={14} />
              {selectedGroupIds.size > 0
                ? `Groups (${selectedGroupIds.size})`
                : "All groups"}
              <Icon icon="solar:alt-arrow-down-linear" width={12} />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label="Filter by group"
                selectionMode="multiple"
                selectedKeys={new Set(Array.from(selectedGroupIds).map(String))}
                onSelectionChange={(keys) =>
                  handleGroupSelection(keys as Set<string>)
                }
                className="bg-surface-base border border-border-base"
              >
                {groups.length === 0 ? (
                  <Dropdown.Item key="__empty" id="__empty" isDisabled>
                    No groups available
                  </Dropdown.Item>
                ) : (
                  groups.map((g) => (
                    <Dropdown.Item key={g.id.toString()} id={g.id.toString()}>
                      {g.name}
                    </Dropdown.Item>
                  ))
                )}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          {selectedGroupIds.size > 0 && (
            <button
              onClick={() => setSelectedGroupIds(new Set())}
              className="text-xs text-text-tertiary hover:text-text-secondary underline underline-offset-2"
            >
              Clear
            </button>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="reports-print-hide relative z-10 flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.08] p-1 w-fit backdrop-blur-xl"
      >
        {TAB_OPTIONS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
              tab === t.value
                ? "bg-accent-400/15 text-accent-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <Icon icon={t.icon} width={14} />
            {t.label}
          </button>
        ))}
      </motion.div>

      <motion.div
        key={`${scope}-${tab}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 space-y-5"
      >
        {tab === "geographic" ? (
          <GeographicEmptyState />
        ) : (
          <>
            <KpiStrip totals={totals} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <ReportDonut rows={currentRows} totalLabel="Views" />
              <div className="lg:col-span-2">
                <ReportTable
                  rows={currentRows}
                  dimensionLabel={dimensionLabel}
                  tab={tab}
                  isLoading={isLoading}
                  postCount={filteredPosts.length}
                />
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function KpiStrip({
  totals,
}: {
  totals: ReturnType<typeof aggregateTotals>;
}) {
  const items = [
    {
      label: "Total Posts",
      value: totals.postCount.toLocaleString(),
      icon: "solar:documents-bold-duotone",
      tint: "bg-sky-500/15 text-sky-300",
    },
    {
      label: "Total Views",
      value: formatNumber(totals.views),
      icon: "solar:eye-bold-duotone",
      tint: "bg-accent-400/15 text-accent-400",
    },
    {
      label: "Total Likes",
      value: formatNumber(totals.likes),
      icon: "solar:heart-bold-duotone",
      tint: "bg-rose-500/15 text-rose-300",
    },
    {
      label: "Total Comments",
      value: formatNumber(totals.comments),
      icon: "solar:chat-round-dots-bold-duotone",
      tint: "bg-violet-500/15 text-violet-300",
    },
    {
      label: "Engagement Rate",
      value: `${totals.engRate.toFixed(2)}%`,
      icon: "solar:heart-pulse-bold-duotone",
      tint: "bg-emerald-500/15 text-emerald-300",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="reports-card rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl ${it.tint}`}>
              <Icon icon={it.icon} width={18} />
            </div>
            <div className="min-w-0">
              <p className="reports-muted text-[11px] text-text-tertiary font-medium tracking-wide truncate">
                {it.label}
              </p>
              <p className="text-xl font-bold text-text-primary truncate">
                {it.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportDonut({
  rows,
  totalLabel,
}: {
  rows: ReportRow[];
  totalLabel: string;
}) {
  const filtered = rows.filter((r) => r.views > 0);
  const total = filtered.reduce((s, r) => s + r.views, 0);

  if (filtered.length === 0) {
    return (
      <div className="reports-card rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] h-full flex flex-col">
        <p className="reports-muted text-xs text-text-tertiary font-medium tracking-wide mb-4">
          VIEW SHARE
        </p>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
          <Icon
            icon="solar:chart-2-bold"
            width={40}
            className="text-text-tertiary"
          />
          <p className="text-sm text-text-tertiary text-center">
            No view data in this range
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-card rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] h-full flex flex-col">
      <p className="reports-muted text-xs text-text-tertiary font-medium tracking-wide mb-4">
        VIEW SHARE
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={filtered}
            dataKey="views"
            nameKey="label"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            stroke="none"
          >
            {filtered.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
            <Label
              position="center"
              content={() => (
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  <tspan
                    x="50%"
                    dy="-0.4em"
                    fill="var(--color-text-primary, #fff)"
                    style={{ fontSize: "1.25rem", fontWeight: 700 }}
                  >
                    {formatNumber(total)}
                  </tspan>
                  <tspan
                    x="50%"
                    dy="1.4em"
                    fill="var(--color-text-tertiary, #9ca3af)"
                    style={{ fontSize: "0.75rem" }}
                  >
                    {totalLabel}
                  </tspan>
                </text>
              )}
            />
          </Pie>
          <RTooltip
            wrapperStyle={{ pointerEvents: "none" }}
            animationDuration={0}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ReportRow;
              const pct = total > 0 ? ((p.views / total) * 100).toFixed(1) : "0";
              return (
                <div className="rounded-lg border border-border-base bg-surface-base text-xs shadow-lg min-w-[140px] p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-sm text-text-primary font-medium">
                      {p.label}
                    </span>
                  </div>
                  <div className="text-sm text-text-secondary flex justify-between gap-4">
                    <span>{formatNumber(p.views)} views</span>
                    <span className="text-text-tertiary">{pct}%</span>
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1.5">
        {filtered.map((r) => {
          const pct = total > 0 ? ((r.views / total) * 100).toFixed(1) : "0";
          return (
            <div key={r.key} className="flex items-center gap-2 text-sm px-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: r.color }}
              />
              <span className="text-text-primary truncate flex-1">
                {r.label}
              </span>
              <span className="text-text-secondary font-medium">
                {formatNumber(r.views)}
              </span>
              <span className="reports-muted text-text-tertiary w-12 text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportTable({
  rows,
  dimensionLabel,
  tab,
  isLoading,
  postCount,
}: {
  rows: ReportRow[];
  dimensionLabel: string;
  tab: ReportTab;
  isLoading: boolean;
  postCount: number;
}) {
  const hasData = rows.some((r) => r.postCount > 0);

  if (isLoading) {
    return (
      <div className="reports-card rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] flex items-center justify-center">
        <Icon
          icon="solar:refresh-bold"
          width={20}
          className="text-text-tertiary animate-spin"
        />
      </div>
    );
  }

  if (!hasData || postCount === 0) {
    return (
      <div className="reports-card rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-10 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]">
        <Icon
          icon="solar:inbox-bold-duotone"
          width={40}
          className="mx-auto text-text-tertiary mb-2"
        />
        <p className="text-sm text-text-tertiary">
          No posts match this date range and filter.
        </p>
      </div>
    );
  }

  return (
    <div className="reports-card rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary border-b border-white/[0.06]">
              <th className="px-5 py-3 font-medium">{dimensionLabel}</th>
              <th className="px-5 py-3 font-medium text-right">Posts</th>
              <th className="px-5 py-3 font-medium text-right">Views</th>
              <th className="px-5 py-3 font-medium text-right">Likes</th>
              <th className="px-5 py-3 font-medium text-right">Comments</th>
              <th className="px-5 py-3 font-medium text-right">Eng. rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02]"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    {tab === "platform" ? (
                      <Icon
                        icon={platformIcon(r.key)}
                        width={16}
                        className={platformIconColor(r.key)}
                      />
                    ) : (
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                    )}
                    <span className="font-medium text-text-primary">
                      {r.label}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right text-text-secondary tabular-nums">
                  {r.postCount.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right text-text-primary font-semibold tabular-nums">
                  {formatNumber(r.views)}
                </td>
                <td className="px-5 py-3 text-right text-text-secondary tabular-nums">
                  {formatNumber(r.likes)}
                </td>
                <td className="px-5 py-3 text-right text-text-secondary tabular-nums">
                  {formatNumber(r.comments)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  <Chip
                    size="sm"
                    className="bg-accent-400/10 text-accent-400 border border-accent-400/20"
                  >
                    {r.engRate.toFixed(2)}%
                  </Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GeographicEmptyState() {
  return (
    <div className="reports-card rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-10 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-accent-400/15 text-accent-400 flex items-center justify-center mb-4">
        <Icon icon="solar:map-point-bold-duotone" width={28} />
      </div>
      <p className="text-lg font-semibold text-text-primary">
        Geographic breakdowns are coming soon
      </p>
      <p className="text-sm text-text-tertiary mt-1 max-w-md mx-auto">
        We&apos;re working on collecting location signals from platform APIs so
        you can slice performance by country and region.
      </p>
    </div>
  );
}
