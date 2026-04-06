import type { CompetitorCardData } from "@/components/CompetitorCard";
import type { AccountRow } from "@/components/AccountsTable";
import type { FeedPost } from "@/components/ActivityFeed";
import type { CompetitorMetrics } from "@/components/HeadToHeadTable";
import type { StatCardItem } from "@clipper/shared-ui";
import type { ChartDataPoint } from "@/components/OverviewChart";

export const MOCK_STATS: StatCardItem[] = [
  {
    title: "TOTAL VIEWS",
    value: "4.2M",
    icon: "solar:eye-bold-duotone",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-400/10",
    change: 12.3,
    tooltip: "Total views across all tracked accounts",
  },
  {
    title: "ENGAGEMENTS",
    value: "312K",
    icon: "solar:heart-bold-duotone",
    iconColor: "text-red-400",
    iconBg: "bg-red-400/10",
    change: 8.1,
  },
  {
    title: "TOTAL POSTS",
    value: "847",
    icon: "solar:document-bold-duotone",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-400/10",
    change: 3.2,
  },
  {
    title: "FOLLOWERS",
    value: "1.8M",
    icon: "solar:users-group-rounded-bold-duotone",
    iconColor: "text-purple-400",
    iconBg: "bg-purple-400/10",
    change: 5.7,
  },
  {
    title: "AVG ENG RATE",
    value: "4.82%",
    icon: "solar:chart-bold-duotone",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10",
    change: 0.34,
    absoluteChange: true,
  },
  {
    title: "CONTENT VELOCITY",
    value: "12.3/wk",
    icon: "solar:rocket-2-bold-duotone",
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-400/10",
    change: -2.1,
    tooltip: "Average posts per week across all accounts",
  },
];

export const MOCK_COMPETITORS: CompetitorCardData[] = [
  {
    id: -1,
    name: "My Performance",
    accountCount: 3,
    followers: 245000,
    totalViews: 1200000,
    engRate: 5.12,
    avgViews: 42000,
    platforms: ["tiktok", "instagram"],
    followersChange: 4.2,
    viewsChange: 15.3,
    engRateChange: 0.21,
    isMyPerformance: true,
  },
  {
    id: 1,
    name: "BrandRival",
    accountCount: 4,
    followers: 520000,
    totalViews: 1800000,
    engRate: 3.45,
    avgViews: 38000,
    platforms: ["tiktok", "instagram", "x"],
    followersChange: 2.8,
    viewsChange: 8.7,
    engRateChange: -0.12,
  },
  {
    id: 2,
    name: "ContentKing",
    accountCount: 2,
    followers: 890000,
    totalViews: 3200000,
    engRate: 6.21,
    avgViews: 64000,
    platforms: ["tiktok", "instagram"],
    followersChange: 7.1,
    viewsChange: 22.4,
    engRateChange: 0.45,
  },
  {
    id: 3,
    name: "ViralStudio",
    accountCount: 3,
    followers: 340000,
    totalViews: 920000,
    engRate: 4.18,
    avgViews: 28000,
    platforms: ["instagram", "x"],
    followersChange: -1.2,
    viewsChange: -3.5,
    engRateChange: -0.08,
  },
];

export const MOCK_H2H: CompetitorMetrics[] = [
  { name: "My Performance", followers: 245000, totalViews: 1200000, totalPosts: 189, engRate: 5.12, postsPerWeek: 12, avgViews: 42000 },
  { name: "BrandRival", followers: 520000, totalViews: 1800000, totalPosts: 312, engRate: 3.45, postsPerWeek: 15, avgViews: 38000 },
  { name: "ContentKing", followers: 890000, totalViews: 3200000, totalPosts: 210, engRate: 6.21, postsPerWeek: 8, avgViews: 64000 },
  { name: "ViralStudio", followers: 340000, totalViews: 920000, totalPosts: 136, engRate: 4.18, postsPerWeek: 10, avgViews: 28000 },
];

export const MOCK_ACCOUNTS: AccountRow[] = [
  { id: 1, username: "cuttr_official", displayName: "Cuttr", platform: "tiktok", accountType: "profile", competitorName: "My Performance", competitorId: -1, views: 680000, avgViews: 45000, postCount: 82, isActive: true, alertEnabled: true, syncStatus: "completed" },
  { id: 2, username: "cuttr_ig", displayName: "Cuttr", platform: "instagram", accountType: "profile", competitorName: "My Performance", competitorId: -1, views: 320000, avgViews: 28000, postCount: 64, isActive: true, alertEnabled: true, syncStatus: "completed" },
  { id: 3, username: "cuttr_x", displayName: "Cuttr", platform: "x", accountType: "profile", competitorName: "My Performance", competitorId: -1, views: 200000, avgViews: 15000, postCount: 43, isActive: true, alertEnabled: false, syncStatus: "completed" },
  { id: 4, username: "brandrival", displayName: "BrandRival", platform: "tiktok", accountType: "profile", competitorName: "BrandRival", competitorId: 1, views: 920000, avgViews: 42000, postCount: 128, isActive: true, alertEnabled: true, syncStatus: "completed" },
  { id: 5, username: "brandrival_ig", displayName: "BrandRival", platform: "instagram", accountType: "profile", competitorName: "BrandRival", competitorId: 1, views: 540000, avgViews: 32000, postCount: 96, isActive: true, alertEnabled: false, syncStatus: "completed" },
  { id: 6, username: "brandrival_x", displayName: "BrandRival", platform: "x", accountType: "profile", competitorName: "BrandRival", competitorId: 1, views: 180000, avgViews: 12000, postCount: 52, isActive: true, alertEnabled: false, syncStatus: "completed" },
  { id: 7, username: "brandrival_yt", displayName: "BrandRival", platform: "instagram", accountType: "profile", competitorName: "BrandRival", competitorId: 1, views: 160000, avgViews: 18000, postCount: 36, isActive: false, alertEnabled: false, syncStatus: "pending" },
  { id: 8, username: "contentking", displayName: "ContentKing", platform: "tiktok", accountType: "profile", competitorName: "ContentKing", competitorId: 2, views: 2100000, avgViews: 72000, postCount: 134, isActive: true, alertEnabled: true, syncStatus: "completed" },
  { id: 9, username: "contentking_ig", displayName: "ContentKing", platform: "instagram", accountType: "profile", competitorName: "ContentKing", competitorId: 2, views: 1100000, avgViews: 56000, postCount: 76, isActive: true, alertEnabled: true, syncStatus: "completed" },
  { id: 10, username: "viralstudio", displayName: "Viral Studio", platform: "instagram", accountType: "profile", competitorName: "ViralStudio", competitorId: 3, views: 520000, avgViews: 32000, postCount: 68, isActive: true, alertEnabled: false, syncStatus: "completed" },
  { id: 11, username: "viralstudio_x", displayName: "Viral Studio", platform: "x", accountType: "profile", competitorName: "ViralStudio", competitorId: 3, views: 240000, avgViews: 18000, postCount: 42, isActive: true, alertEnabled: false, syncStatus: "completed" },
  { id: 12, username: "viralstudio_tt", displayName: "Viral Studio", platform: "tiktok", accountType: "profile", competitorName: "ViralStudio", competitorId: 3, views: 160000, avgViews: 14000, postCount: 26, isActive: true, alertEnabled: true, syncStatus: "syncing" },
];

export const MOCK_POSTS: FeedPost[] = [
  { id: 1, accountId: 8, accountUsername: "contentking", platform: "tiktok", caption: "This editing trick will blow your mind #editing #contentcreator", thumbnailUrl: null, postUrl: "https://tiktok.com/@contentking/1", postedAt: "2026-04-04T14:30:00Z", likeCount: 89000, commentCount: 3200, viewCount: 1200000 },
  { id: 2, accountId: 4, accountUsername: "brandrival", platform: "tiktok", caption: "POV: When your competitor launches a new feature", thumbnailUrl: null, postUrl: "https://tiktok.com/@brandrival/1", postedAt: "2026-04-03T10:15:00Z", likeCount: 45000, commentCount: 1800, viewCount: 680000 },
  { id: 3, accountId: 1, accountUsername: "cuttr_official", platform: "tiktok", caption: "5 ways to repurpose your content with AI", thumbnailUrl: null, postUrl: "https://tiktok.com/@cuttr_official/1", postedAt: "2026-04-04T08:00:00Z", likeCount: 32000, commentCount: 980, viewCount: 420000 },
  { id: 4, accountId: 9, accountUsername: "contentking_ig", platform: "instagram", caption: "Behind the scenes of our latest viral campaign", thumbnailUrl: null, postUrl: "https://instagram.com/p/1", postedAt: "2026-04-02T16:45:00Z", likeCount: 28000, commentCount: 1200, viewCount: 350000 },
  { id: 5, accountId: 10, accountUsername: "viralstudio", platform: "instagram", caption: "The algorithm doesn't care about your feelings. Here's what it does care about...", thumbnailUrl: null, postUrl: "https://instagram.com/p/2", postedAt: "2026-04-04T12:00:00Z", likeCount: 18000, commentCount: 890, viewCount: 210000 },
  { id: 6, accountId: 2, accountUsername: "cuttr_ig", platform: "instagram", caption: "New feature drop: Auto-detect viral moments in your videos", thumbnailUrl: null, postUrl: "https://instagram.com/p/3", postedAt: "2026-04-03T09:30:00Z", likeCount: 15000, commentCount: 620, viewCount: 180000 },
  { id: 7, accountId: 5, accountUsername: "brandrival_ig", platform: "instagram", caption: "Our content strategy for Q2 - thread", thumbnailUrl: null, postUrl: "https://instagram.com/p/4", postedAt: "2026-04-01T11:00:00Z", likeCount: 12000, commentCount: 450, viewCount: 145000 },
  { id: 8, accountId: 8, accountUsername: "contentking", platform: "tiktok", caption: "Why your hooks aren't working (and how to fix them)", thumbnailUrl: null, postUrl: "https://tiktok.com/@contentking/2", postedAt: "2026-04-04T06:00:00Z", likeCount: 56000, commentCount: 2100, viewCount: 890000 },
  { id: 9, accountId: 11, accountUsername: "viralstudio_x", platform: "x", caption: "Hot take: Short-form content is dying. Long-form is making a comeback.", thumbnailUrl: null, postUrl: "https://x.com/viralstudio_x/1", postedAt: "2026-04-04T15:00:00Z", likeCount: 8200, commentCount: 340, viewCount: 95000 },
  { id: 10, accountId: 1, accountUsername: "cuttr_official", platform: "tiktok", caption: "We analyzed 10,000 viral videos. Here's what we found.", thumbnailUrl: null, postUrl: "https://tiktok.com/@cuttr_official/2", postedAt: "2026-04-02T13:00:00Z", likeCount: 41000, commentCount: 1500, viewCount: 520000 },
  { id: 11, accountId: 4, accountUsername: "brandrival", platform: "tiktok", caption: "Day in the life of a content team at a startup", thumbnailUrl: null, postUrl: "https://tiktok.com/@brandrival/2", postedAt: "2026-04-01T08:30:00Z", likeCount: 22000, commentCount: 780, viewCount: 310000 },
  { id: 12, accountId: 3, accountUsername: "cuttr_x", platform: "x", caption: "Thread: How we grew from 0 to 100K followers in 6 months", thumbnailUrl: null, postUrl: "https://x.com/cuttr_x/1", postedAt: "2026-04-03T14:00:00Z", likeCount: 9800, commentCount: 420, viewCount: 125000 },
];

function generateChartData(): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  const now = new Date("2026-04-05T00:00:00Z");
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const base = 30000 + Math.random() * 20000;
    data.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      views: Math.round(base + Math.random() * 50000 + (30 - i) * 1500),
      likes: Math.round(base * 0.08 + Math.random() * 3000),
      comments: Math.round(base * 0.02 + Math.random() * 800),
    });
  }
  return data;
}

export const MOCK_CHART_DATA = generateChartData();
