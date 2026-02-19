import type { MassPostingAccount } from "@/types/massPosting";

// Preserved for future accounts tab implementation
export const MOCK_ACCOUNTS: MassPostingAccount[] = [];

export const MOCK_ACCOUNT_STATS = {
  totalAccounts: { value: 0, change: 0 },
  activeAccounts: { value: 0, change: 0 },
  totalReposts: { value: 0, change: 0 },
  avgPostsPerAccount: { value: 0, change: 0 },
};
