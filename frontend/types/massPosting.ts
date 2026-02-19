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

// --- Dashboard entity types (frontend-only for now) ---

export type MassPostingPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "facebook"
  | "linkedin";

export type QueuedPostStatus = "queued" | "processing" | "failed";

export interface QueuedPost {
  id: string;
  title: string;
  thumbnailUrl: string;
  duration: string;
  resolution: string;
  dateSubmitted: string;
  platforms: MassPostingPlatform[];
  status: QueuedPostStatus;
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

export interface PublishedPost {
  id: string;
  title: string;
  thumbnailUrl: string;
  accountName: string;
  accountAvatarUrl: string;
  platform: MassPostingPlatform;
  publishedDate: string;
  postUrl: string;
}
