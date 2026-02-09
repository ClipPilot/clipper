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
