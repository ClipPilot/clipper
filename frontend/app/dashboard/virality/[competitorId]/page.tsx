"use client";

import { useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Pagination,
} from "@heroui/react";
import { Icon } from "@iconify/react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Platform = "tiktok" | "instagram" | "x";
type TabKey = "overview" | Platform;

interface PlatformAccount {
  platform: Platform;
  username: string;
  followers: number;
  totalLikes: number;
  totalPosts: number;
}

interface Post {
  id: number;
  platform: Platform;
  thumbnail: string;
  caption: string;
  postedDate: string;
  likes: number;
  comments: number;
  views: number;
}

// ─── Dummy Data ──────────────────────────────────────────────────────────────

const competitor = {
  name: "CreatorScale",
  description: "Main competitor",
};

const accounts: PlatformAccount[] = [
  { platform: "tiktok", username: "creatorscale", followers: 284000, totalLikes: 3200000, totalPosts: 412 },
  { platform: "instagram", username: "creatorscale", followers: 196000, totalLikes: 1800000, totalPosts: 328 },
  { platform: "x", username: "creatorscale", followers: 91000, totalLikes: 720000, totalPosts: 1540 },
];

const now = Date.now();
const DAY = 86400000;

const dummyPosts: Post[] = [
  // TikTok posts
  { id: 1, platform: "tiktok", thumbnail: "", caption: "How we scaled to 100K followers in 30 days", postedDate: new Date(now - 2 * DAY).toISOString(), likes: 48200, comments: 1340, views: 892000 },
  { id: 2, platform: "tiktok", thumbnail: "", caption: "POV: Your content strategy actually works", postedDate: new Date(now - 6 * DAY).toISOString(), likes: 35100, comments: 980, views: 654000 },
  { id: 3, platform: "tiktok", thumbnail: "", caption: "3 hooks that stop the scroll every time", postedDate: new Date(now - 10 * DAY).toISOString(), likes: 62400, comments: 2100, views: 1120000 },
  { id: 4, platform: "tiktok", thumbnail: "", caption: "Replying to comments live - growth hack", postedDate: new Date(now - 15 * DAY).toISOString(), likes: 29800, comments: 870, views: 510000 },
  { id: 5, platform: "tiktok", thumbnail: "", caption: "Why your reels aren't getting views", postedDate: new Date(now - 20 * DAY).toISOString(), likes: 41300, comments: 1560, views: 780000 },
  { id: 6, platform: "tiktok", thumbnail: "", caption: "Day in my life as a content creator", postedDate: new Date(now - 25 * DAY).toISOString(), likes: 22100, comments: 640, views: 420000 },
  // Instagram posts
  { id: 7, platform: "instagram", thumbnail: "", caption: "Behind the scenes of our latest shoot", postedDate: new Date(now - 1 * DAY).toISOString(), likes: 18400, comments: 520, views: 245000 },
  { id: 8, platform: "instagram", thumbnail: "", caption: "New collection dropping this Friday", postedDate: new Date(now - 5 * DAY).toISOString(), likes: 24600, comments: 890, views: 312000 },
  { id: 9, platform: "instagram", thumbnail: "", caption: "Studio tour - where the magic happens", postedDate: new Date(now - 9 * DAY).toISOString(), likes: 31200, comments: 1100, views: 398000 },
  { id: 10, platform: "instagram", thumbnail: "", caption: "Collab announcement with @designstudio", postedDate: new Date(now - 14 * DAY).toISOString(), likes: 42800, comments: 1680, views: 520000 },
  { id: 11, platform: "instagram", thumbnail: "", caption: "Carousel: 5 tips for better engagement", postedDate: new Date(now - 19 * DAY).toISOString(), likes: 36500, comments: 1420, views: 445000 },
  { id: 12, platform: "instagram", thumbnail: "", caption: "Throwback to our first viral post", postedDate: new Date(now - 24 * DAY).toISOString(), likes: 15800, comments: 380, views: 198000 },
  // X posts
  { id: 13, platform: "x", thumbnail: "", caption: "Thread: How algorithms actually decide what goes viral", postedDate: new Date(now - 3 * DAY).toISOString(), likes: 8900, comments: 340, views: 185000 },
  { id: 14, platform: "x", thumbnail: "", caption: "Hot take: Consistency beats virality every time", postedDate: new Date(now - 7 * DAY).toISOString(), likes: 12400, comments: 580, views: 264000 },
  { id: 15, platform: "x", thumbnail: "", caption: "Just hit 90K followers. Here's what I learned", postedDate: new Date(now - 11 * DAY).toISOString(), likes: 15200, comments: 720, views: 328000 },
  { id: 16, platform: "x", thumbnail: "", caption: "The creator economy is not slowing down", postedDate: new Date(now - 16 * DAY).toISOString(), likes: 6800, comments: 290, views: 142000 },
  { id: 17, platform: "x", thumbnail: "", caption: "Engagement pods don't work. Here's proof.", postedDate: new Date(now - 21 * DAY).toISOString(), likes: 19500, comments: 940, views: 410000 },
  { id: 18, platform: "x", thumbnail: "", caption: "Building in public update: Month 6 results", postedDate: new Date(now - 27 * DAY).toISOString(), likes: 7200, comments: 310, views: 156000 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const platformColors: Record<Platform, string> = {
  tiktok: "#00f2ea",
  instagram: "#E1306C",
  x: "#ffffff",
};

const platformIcons: Record<Platform, string> = {
  tiktok: "ri:tiktok-fill",
  instagram: "ri:instagram-fill",
  x: "ri:twitter-x-fill",
};

const platformChipClass: Record<Platform, string> = {
  tiktok: "bg-red-500/10 text-red-500",
  instagram: "bg-pink-500/10 text-pink-500",
  x: "bg-gray-500/10 text-gray-400",
};

function formatNumber(num: number) {
  const abs = Math.abs(num);
  if (abs >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── SVG Line Chart ──────────────────────────────────────────────────────────

interface DataPoint {
  date: string;
  views: number;
  platform: Platform;
}

function ViewsChart({ posts, platforms }: { posts: Post[]; platforms: Platform[] }) {
  const width = 700;
  const height = 260;
  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  // Group posts by platform, sort by date
  const lines = useMemo(() => {
    return platforms.map((p) => {
      const pts = posts
        .filter((post) => post.platform === p)
        .sort((a, b) => new Date(a.postedDate).getTime() - new Date(b.postedDate).getTime())
        .map((post) => ({ date: post.postedDate, views: post.views }));
      return { platform: p, points: pts };
    });
  }, [posts, platforms]);

  // Compute global min/max
  const allViews = posts.map((p) => p.views);
  const allDates = posts.map((p) => new Date(p.postedDate).getTime());
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const maxViews = Math.max(...allViews);
  const dateRange = maxDate - minDate || 1;

  const scaleX = (date: string) => padL + ((new Date(date).getTime() - minDate) / dateRange) * chartW;
  const scaleY = (views: number) => padT + chartH - (views / (maxViews * 1.1)) * chartH;

  // Y-axis labels
  const yTicks = [0, Math.round(maxViews * 0.33), Math.round(maxViews * 0.66), maxViews];

  // X-axis labels (first and last date, plus midpoint)
  const xTicks = [minDate, minDate + dateRange / 2, maxDate];

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-text-primary">Views Over Time</p>
          <div className="flex items-center gap-4">
            {platforms.map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: platformColors[p] }} />
                <span className="text-xs text-text-tertiary capitalize">{p === "x" ? "X" : p}</span>
              </div>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={padL}
              x2={width - padR}
              y1={scaleY(tick)}
              y2={scaleY(tick)}
              stroke="#2a2d3e"
              strokeWidth="1"
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick) => (
            <text
              key={`y-${tick}`}
              x={padL - 8}
              y={scaleY(tick) + 4}
              textAnchor="end"
              fill="#6b7280"
              fontSize="11"
            >
              {formatNumber(tick)}
            </text>
          ))}

          {/* X-axis labels */}
          {xTicks.map((tick, i) => (
            <text
              key={`x-${i}`}
              x={padL + (((tick - minDate) / dateRange) * chartW)}
              y={height - 8}
              textAnchor="middle"
              fill="#6b7280"
              fontSize="11"
            >
              {new Date(tick).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </text>
          ))}

          {/* Lines */}
          {lines.map(({ platform, points }) => {
            if (points.length < 2) return null;
            const pathD = points
              .map((pt, i) => `${i === 0 ? "M" : "L"} ${scaleX(pt.date)} ${scaleY(pt.views)}`)
              .join(" ");
            return (
              <g key={platform}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={platformColors[platform]}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Data points */}
                {points.map((pt, i) => (
                  <circle
                    key={i}
                    cx={scaleX(pt.date)}
                    cy={scaleY(pt.views)}
                    r="4"
                    fill={platformColors[platform]}
                    fillOpacity="0.9"
                    stroke="#0d0f1a"
                    strokeWidth="2"
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </CardBody>
    </Card>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CompetitorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [page, setPage] = useState(1);
  const rowsPerPage = 6;

  // Reset pagination when tab changes
  const handleTabChange = (key: React.Key) => {
    setActiveTab(key as TabKey);
    setPage(1);
  };

  // Compute stats based on active tab
  const stats = useMemo(() => {
    const relevantAccounts = activeTab === "overview" ? accounts : accounts.filter((a) => a.platform === activeTab);
    return {
      followers: relevantAccounts.reduce((sum, a) => sum + a.followers, 0),
      totalLikes: relevantAccounts.reduce((sum, a) => sum + a.totalLikes, 0),
      totalPosts: relevantAccounts.reduce((sum, a) => sum + a.totalPosts, 0),
    };
  }, [activeTab]);

  // Filter posts based on active tab
  const filteredPosts = useMemo(() => {
    const posts = activeTab === "overview" ? dummyPosts : dummyPosts.filter((p) => p.platform === activeTab);
    return [...posts].sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
  }, [activeTab]);

  // Platforms to show on chart
  const chartPlatforms: Platform[] = activeTab === "overview" ? ["tiktok", "instagram", "x"] : [activeTab as Platform];

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / rowsPerPage);
  const paginatedPosts = filteredPosts.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const statCards = [
    {
      title: "FOLLOWERS",
      value: formatNumber(stats.followers),
      icon: "solar:users-group-rounded-bold",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
    },
    {
      title: "TOTAL LIKES",
      value: formatNumber(stats.totalLikes),
      icon: "solar:heart-bold",
      iconColor: "text-red-500",
      iconBg: "bg-red-500/10",
    },
    {
      title: "TOTAL POSTS",
      value: formatNumber(stats.totalPosts),
      icon: "solar:document-bold",
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-surface-dark p-6 lg:p-8"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="flat"
            isIconOnly
            className="bg-surface-base"
            onPress={() => router.push("/dashboard/virality")}
          >
            <Icon icon="solar:arrow-left-linear" width={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{competitor.name}</h1>
            <p className="text-text-secondary text-sm">{competitor.description}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={handleTabChange}
          variant="underlined"
          classNames={{
            tabList: "border-b border-border-base",
            cursor: "bg-accent-400",
            tab: "text-text-tertiary data-[selected=true]:text-text-primary",
          }}
        >
          <Tab key="overview" title="Overview" />
          <Tab
            key="tiktok"
            title={
              <div className="flex items-center gap-1.5">
                <Icon icon="ri:tiktok-fill" width={14} />
                TikTok
              </div>
            }
          />
          <Tab
            key="instagram"
            title={
              <div className="flex items-center gap-1.5">
                <Icon icon="ri:instagram-fill" width={14} />
                Instagram
              </div>
            }
          />
          <Tab
            key="x"
            title={
              <div className="flex items-center gap-1.5">
                <Icon icon="ri:twitter-x-fill" width={14} />
                X
              </div>
            }
          />
        </Tabs>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="bg-surface-base border border-border-base">
              <CardBody className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                    <Icon icon={stat.icon} width={24} className={stat.iconColor} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-text-tertiary font-medium tracking-wide mb-1">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Views Chart */}
        <ViewsChart posts={filteredPosts} platforms={chartPlatforms} />

        {/* Posts Table */}
        <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
          <Table
            aria-label="Competitor posts table"
            removeWrapper
            classNames={{
              th: "bg-surface-elevated text-text-tertiary text-xs font-medium uppercase tracking-wider py-4 px-4",
              td: "py-4 px-4 border-t border-border-base",
            }}
          >
            <TableHeader>
              <TableColumn>POST</TableColumn>
              <TableColumn>PLATFORM</TableColumn>
              <TableColumn>POSTED</TableColumn>
              <TableColumn>LIKES</TableColumn>
              <TableColumn>COMMENTS</TableColumn>
              <TableColumn>VIEWS</TableColumn>
            </TableHeader>
            <TableBody>
              {paginatedPosts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <div className="flex items-center gap-3 max-w-sm">
                      <Avatar
                        name={post.platform.charAt(0).toUpperCase()}
                        size="sm"
                        classNames={{ base: "bg-surface-hover flex-shrink-0" }}
                      />
                      <p className="text-sm text-text-primary truncate">{post.caption}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      variant="flat"
                      startContent={<Icon icon={platformIcons[post.platform]} width={14} />}
                      classNames={{ base: platformChipClass[post.platform] }}
                    >
                      {post.platform === "x" ? "X" : post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-text-secondary">{formatDate(post.postedDate)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-text-primary">{formatNumber(post.likes)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-text-primary">{formatNumber(post.comments)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-text-primary">{formatNumber(post.views)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-4 border-t border-border-base">
            <p className="text-sm text-text-tertiary">
              Showing {paginatedPosts.length} of {filteredPosts.length} posts
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
      </div>
    </motion.div>
  );
}
