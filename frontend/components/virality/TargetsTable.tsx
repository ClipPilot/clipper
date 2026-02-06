"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Chip,
  Button,
  Switch,
  Pagination,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";

export type Platform = "tiktok" | "instagram" | "x";
export type TargetStatus = "live" | "paused";

export interface TrackedTarget {
  id: number;
  username: string;
  category: string;
  platform: Platform;
  avatar?: string;
  dailyViewGain: number;
  dailyLikeGain: number;
  likeGainPercent: number;
  status: TargetStatus;
  sparklineData: number[];
}

// Dummy data
const dummyTargets: TrackedTarget[] = [
  {
    id: 1,
    username: "tech_guru",
    category: "Tech & Lifestyle",
    platform: "tiktok",
    dailyViewGain: 124500,
    dailyLikeGain: 12400,
    likeGainPercent: 8.2,
    status: "live",
    sparklineData: [20, 35, 25, 45, 40, 55, 50, 65],
  },
  {
    id: 2,
    username: "style_icon",
    category: "Fashion Designer",
    platform: "instagram",
    dailyViewGain: -12300,
    dailyLikeGain: 2100,
    likeGainPercent: -3.1,
    status: "live",
    sparklineData: [60, 55, 50, 45, 48, 42, 38, 35],
  },
  {
    id: 3,
    username: "gaming_hub",
    category: "Esports News",
    platform: "x",
    dailyViewGain: 450200,
    dailyLikeGain: 45800,
    likeGainPercent: 12.0,
    status: "paused",
    sparklineData: [15, 25, 35, 30, 45, 55, 60, 70],
  },
  {
    id: 4,
    username: "fitness_pro",
    category: "Bodybuilding Expert",
    platform: "tiktok",
    dailyViewGain: 60800,
    dailyLikeGain: 8200,
    likeGainPercent: 5.5,
    status: "live",
    sparklineData: [30, 35, 40, 38, 45, 50, 48, 55],
  },
  {
    id: 5,
    username: "foodie_adventures",
    category: "Food & Travel",
    platform: "instagram",
    dailyViewGain: 89000,
    dailyLikeGain: 15600,
    likeGainPercent: 9.8,
    status: "live",
    sparklineData: [25, 30, 35, 45, 50, 55, 60, 65],
  },
  {
    id: 6,
    username: "crypto_daily",
    category: "Finance & Crypto",
    platform: "x",
    dailyViewGain: -5400,
    dailyLikeGain: 3200,
    likeGainPercent: -1.2,
    status: "live",
    sparklineData: [50, 48, 45, 42, 40, 38, 35, 32],
  },
];

interface TargetsTableProps {
  platformFilter: Platform | "all";
  onViewDetails?: (target: TrackedTarget) => void;
}

export function TargetsTable({ platformFilter, onViewDetails }: TargetsTableProps) {
  const [page, setPage] = useState(1);
  const [statuses, setStatuses] = useState<Record<number, TargetStatus>>(
    Object.fromEntries(dummyTargets.map((t) => [t.id, t.status]))
  );
  const rowsPerPage = 4;

  // Filter by platform
  const filteredTargets = dummyTargets.filter(
    (t) => platformFilter === "all" || t.platform === platformFilter
  );

  // Sort by views (descending)
  const sortedTargets = [...filteredTargets].sort(
    (a, b) => Math.abs(b.dailyViewGain) - Math.abs(a.dailyViewGain)
  );

  // Paginate
  const totalPages = Math.ceil(sortedTargets.length / rowsPerPage);
  const paginatedTargets = sortedTargets.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const formatNumber = (num: number) => {
    const abs = Math.abs(num);
    if (abs >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const getPlatformIcon = (platform: Platform) => {
    switch (platform) {
      case "tiktok":
        return "ri:tiktok-fill";
      case "instagram":
        return "ri:instagram-fill";
      case "x":
        return "ri:twitter-x-fill";
    }
  };

  const getPlatformColor = (platform: Platform) => {
    switch (platform) {
      case "tiktok":
        return "bg-red-500/10 text-red-500";
      case "instagram":
        return "bg-pink-500/10 text-pink-500";
      case "x":
        return "bg-gray-500/10 text-gray-400";
    }
  };

  const toggleStatus = (id: number) => {
    setStatuses((prev) => ({
      ...prev,
      [id]: prev[id] === "live" ? "paused" : "live",
    }));
  };

  // Simple sparkline SVG
  const Sparkline = ({ data, isPositive }: { data: number[]; isPositive: boolean }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 80;
    const height = 24;
    const padding = 2;

    const points = data
      .map((val, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((val - min) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} className="inline-block">
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? "#8b5cf6" : "#ef4444"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
      <Table
        aria-label="Tracked targets table"
        removeWrapper
        classNames={{
          th: "bg-surface-elevated text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4",
          td: "py-4 px-4 border-t border-border-base",
        }}
      >
        <TableHeader>
          <TableColumn>TARGET</TableColumn>
          <TableColumn>PLATFORM</TableColumn>
          <TableColumn>DAILY VIEW GAIN</TableColumn>
          <TableColumn>DAILY LIKE GAIN</TableColumn>
          <TableColumn>STATUS</TableColumn>
          <TableColumn>ACTIONS</TableColumn>
        </TableHeader>
        <TableBody>
          {paginatedTargets.map((target) => (
            <TableRow key={target.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar
                    src={target.avatar}
                    name={target.username.charAt(0).toUpperCase()}
                    size="sm"
                    classNames={{
                      base: "bg-surface-hover",
                    }}
                  />
                  <div>
                    <p className="font-medium text-text-primary">
                      @{target.username}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {target.category}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Chip
                  size="sm"
                  variant="flat"
                  startContent={
                    <Icon icon={getPlatformIcon(target.platform)} width={14} />
                  }
                  classNames={{
                    base: getPlatformColor(target.platform),
                  }}
                >
                  {target.platform === "x"
                    ? "X"
                    : target.platform.charAt(0).toUpperCase() +
                      target.platform.slice(1)}
                </Chip>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Sparkline
                    data={target.sparklineData}
                    isPositive={target.dailyViewGain >= 0}
                  />
                  <span
                    className={`font-medium ${
                      target.dailyViewGain >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {target.dailyViewGain >= 0 ? "+" : ""}
                    {formatNumber(target.dailyViewGain)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-text-primary">
                    {formatNumber(target.dailyLikeGain)}
                  </span>
                  <span
                    className={`text-xs ${
                      target.likeGainPercent >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {target.likeGainPercent >= 0 ? "↑" : "↓"}{" "}
                    {Math.abs(target.likeGainPercent)}%
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    size="sm"
                    isSelected={statuses[target.id] === "live"}
                    onValueChange={() => toggleStatus(target.id)}
                    classNames={{
                      wrapper: statuses[target.id] === "live"
                        ? "bg-green-500"
                        : "bg-gray-600",
                    }}
                  />
                  <span
                    className={`text-xs font-medium ${
                      statuses[target.id] === "live"
                        ? "text-green-500"
                        : "text-text-tertiary"
                    }`}
                  >
                    {statuses[target.id] === "live" ? "LIVE" : "PAUSED"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-surface-elevated"
                    onPress={() => onViewDetails?.(target)}
                  >
                    View Details
                  </Button>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        className="bg-surface-elevated"
                      >
                        <Icon icon="solar:menu-dots-bold" width={16} />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Target actions">
                      <DropdownItem key="sync">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:refresh-bold" width={16} />
                          Sync Now
                        </div>
                      </DropdownItem>
                      <DropdownItem key="edit">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:pen-bold" width={16} />
                          Edit
                        </div>
                      </DropdownItem>
                      <DropdownItem key="delete" className="text-danger" color="danger">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:trash-bin-trash-bold" width={16} />
                          Delete
                        </div>
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
        <p className="text-sm text-text-tertiary">
          Showing {paginatedTargets.length} of {sortedTargets.length} Monitored
          Targets
        </p>
        {totalPages > 1 && (
          <Pagination
            total={totalPages}
            page={page}
            onChange={setPage}
            size="sm"
            classNames={{
              item: "bg-surface-elevated text-text-secondary",
              cursor: "bg-accent-400 text-white",
            }}
          />
        )}
      </div>
    </div>
  );
}
