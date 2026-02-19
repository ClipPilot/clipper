export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "linkedin"
  | "facebook"
  | "other";

export interface CompanySocial {
  platform: SocialPlatform;
  url: string;
  handle?: string;
}

export interface CompetitorAccount {
  platform: string;
  url: string;
}

export interface CompetitorSocial {
  companyName: string;
  accounts: CompetitorAccount[];
}

export interface ICP {
  name: string;
  description: string;
  demographics?: string;
  painPoints?: string[];
}

// --- Dashboard entity types ---

export type MassPostingPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "facebook"
  | "linkedin";

export type PostStatus = "scheduled" | "posted" | "cancelled" | "deleted" | "failed";

/** Single post row from the API (joined with clip data) */
export interface TeamPost {
  id: number;
  clip_id: number | null;
  clip_title: string | null;
  clip_url: string | null;
  platform: MassPostingPlatform;
  status: PostStatus;
  content: string;
  post_url: string | null;
  posted_time: string | null;
  created_at: string;
}

/** Grouped queued entry — multiple posts for the same clip */
export interface QueuedGroup {
  clip_id: number | null;
  clip_title: string | null;
  clip_url: string | null;
  posts: TeamPost[];
  earliestCreatedAt: string;
}

export interface PostsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totalPosts: number;
}

export interface TeamPostsResponse {
  posts: TeamPost[];
  pagination: PostsPagination;
}

export interface MassPostingAccount {
  id: string;
  handle: string;
  avatarUrl: string;
  platform: MassPostingPlatform;
  platformDisplayName: string;
  totalReposts: number;
  isActive: boolean;
}
