"use client";

import { motion } from "framer-motion";
import { Button, Card, CardBody, Input, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatNumber } from "@/lib/formatters";
import type { CompetitorWithAccounts, ViralityPost } from "@/api/virality";

// ── Constants ─────────────────────────────────────────────────────────────────

export const AVATAR_COLORS = [
  "border-accent-400 text-accent-400",
  "border-purple-500 text-purple-500",
  "border-emerald-500 text-emerald-500",
  "border-amber-500 text-amber-500",
  "border-blue-500 text-blue-500",
  "border-pink-500 text-pink-500",
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompetitorCardData {
  competitor: CompetitorWithAccounts;
  followers: number;
  totalViews: number;
  engRate: number;
  avgViews: number;
  postsPerWeek: number;
  platforms: string[];
  followersChange: number | null;
  viewsChange: number | null;
  engRateChange: number | null;
}

interface CompetitorCardProps extends CompetitorCardData {
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  postsByAccount: Record<number, ViralityPost[]>;
  editingCompetitorId: number | null;
  editingName: string;
  onEditStart: (id: number, currentName: string) => void;
  onEditNameChange: (name: string) => void;
  onEditSave: (id: number) => void;
  onEditCancel: () => void;
  onViewCompetitor: (id: number) => void;
  /** When true, renders a star icon instead of initials and hides the edit button */
  isMyPerformance?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CompetitorCard({
  competitor,
  followers,
  totalViews,
  engRate,
  avgViews,
  platforms,
  followersChange,
  viewsChange,
  engRateChange,
  index,
  isExpanded,
  onToggleExpand,
  postsByAccount,
  editingCompetitorId,
  editingName,
  onEditStart,
  onEditNameChange,
  onEditSave,
  onEditCancel,
  onViewCompetitor,
  isMyPerformance = false,
}: CompetitorCardProps) {
  const isEditing = !isMyPerformance && editingCompetitorId === competitor.id;
  const totalPosts = competitor.accounts.flatMap((a) => postsByAccount[a.id] || []).length;

  const metrics: { label: string; value: string; change: number | null; absoluteChange?: boolean }[] = [
    { label: "Total Views", value: formatNumber(totalViews), change: viewsChange },
    { label: "Avg. Views", value: formatNumber(avgViews), change: null },
    { label: "Total Posts", value: formatNumber(totalPosts), change: null },
    { label: "Eng. Rate", value: engRate.toFixed(2) + "%", change: engRateChange, absoluteChange: true },
  ];

  return (
    <Card className="bg-surface-base border border-border-base overflow-hidden">
      <CardBody className="p-4 flex flex-col gap-0">
        {/* Top: identity */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 bg-transparent",
              isMyPerformance
                ? "border-accent-400 text-accent-400 bg-accent-400/10"
                : AVATAR_COLORS[index % AVATAR_COLORS.length]
            )}
          >
            {isMyPerformance ? (
              <Icon icon="solar:star-bold" width={18} />
            ) : (
              competitor.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                size="sm"
                value={editingName}
                onValueChange={onEditNameChange}
                autoFocus
                classNames={{
                  inputWrapper: "bg-surface-elevated border-border-base h-7 min-h-0",
                  input: "text-xs",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onEditSave(competitor.id);
                  if (e.key === "Escape") onEditCancel();
                }}
              />
            ) : (
              <>
                <p className="text-sm font-medium text-text-primary truncate">{competitor.name}</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">
                  {competitor.accounts.length} account{competitor.accounts.length !== 1 ? "s" : ""}
                </p>
              </>
            )}
          </div>

          {/* Action buttons */}
          {isEditing ? (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                isIconOnly
                className="bg-accent-400 text-white h-7 w-7 min-w-0"
                onPress={() => onEditSave(competitor.id)}
              >
                <Icon icon="solar:check-read-linear" width={14} />
              </Button>
              <Button
                size="sm"
                isIconOnly
                variant="flat"
                className="bg-surface-elevated h-7 w-7 min-w-0"
                onPress={onEditCancel}
              >
                <Icon icon="solar:close-circle-linear" width={14} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              {!isMyPerformance && (
                <Button
                  size="sm"
                  isIconOnly
                  variant="light"
                  className="text-text-tertiary h-7 w-7 min-w-0"
                  onPress={() => onEditStart(competitor.id, competitor.name)}
                >
                  <Icon icon="solar:pen-2-linear" width={14} />
                </Button>
              )}
              <Button
                size="sm"
                variant="flat"
                className="bg-accent-400/10 text-accent-400 text-[11px] h-7 min-w-0 px-2.5"
                onPress={() => onViewCompetitor(competitor.id)}
              >
                View
              </Button>
            </div>
          )}
        </div>

        {/* Collapsible metrics grid */}
        <motion.div
          initial={false}
          animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="grid grid-cols-2 gap-2 pt-3">
            {metrics.map((m) => (
              <div key={m.label} className="bg-surface-elevated rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-text-tertiary font-medium">{m.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-sm font-bold text-text-primary">{m.value}</p>
                  {m.change != null && (
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        m.change >= 0 ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {m.absoluteChange
                        ? (m.change >= 0 ? "+" : "") + m.change.toFixed(2)
                        : (m.change >= 0 ? "+" : "") + m.change.toFixed(1) + "%"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Expand/collapse toggle */}
        <button
          onClick={onToggleExpand}
          className="w-full flex items-center justify-center pt-2 group cursor-pointer"
        >
          <div className="rounded-full p-1 transition-colors group-hover:bg-surface-elevated">
            <Icon
              icon="solar:alt-arrow-down-linear"
              width={16}
              className={cn(
                "text-text-tertiary transition-all group-hover:text-text-primary",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </button>
      </CardBody>
    </Card>
  );
}
