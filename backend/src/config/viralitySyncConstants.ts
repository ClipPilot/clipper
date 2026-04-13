import { SCRAPE_WINDOW_DAYS, SYNCS_PER_DAY } from "./virality";

export const SYNCS_PER_WEEK = SYNCS_PER_DAY * 7;
export const MASS_POST_SYNC_BUDGET = SCRAPE_WINDOW_DAYS * SYNCS_PER_DAY;
export const VIRALITY_ACCOUNT_INITIAL_SYNCS = 14;
export const USER_ACCOUNT_INITIAL_SYNCS = 14;
export const USER_ACCOUNT_SOURCE_MASS_POSTING = "mass_posting" as const;
export type UserAccountSource = typeof USER_ACCOUNT_SOURCE_MASS_POSTING | null;
