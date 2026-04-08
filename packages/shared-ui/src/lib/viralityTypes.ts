export interface MetricsHistoryEntry {
  recorded_at: string;
  likes?: number | null;
  comments?: number | null;
  views?: number | null;
  followers?: number | null;
  [key: string]: unknown;
}

export interface ViralityPost {
  id: number;
  account_id: number;
  platform_post_id: string;
  post_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  hashtags: string[];
  like_count: number;
  comment_count: number;
  share_count?: number;
  video_play_count: number | null;
  posted_at: string | null;
  post_type: string | null;
  metrics_history: MetricsHistoryEntry[] | null;
  mass_post_id?: number | null;
  campaign_name?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ViralityAccount {
  id: number;
  username: string;
  display_name?: string | null;
  platform: string;
  account_type: string;
  follower_count?: number | null;
  profile_url: string;
  is_active?: boolean;
  alert_enabled?: boolean;
  sync_status?: string;
  last_synced_at?: string | null;
  follower_history?: MetricsHistoryEntry[] | null;
  [key: string]: unknown;
}
