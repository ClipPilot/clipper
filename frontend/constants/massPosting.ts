import type { CompanySocial, CompetitorSocial, ICP } from "@/types/massPosting";

export const CPM_TIERS = [
  { label: "Tier 1", minBudget: 5000, maxBudget: 15000, cpm: 2.5, budgetRange: "$5K–$15K" },
  { label: "Tier 2", minBudget: 15000, maxBudget: 40000, cpm: 2.0, budgetRange: "$15K–$40K" },
  { label: "Tier 3", minBudget: 40000, maxBudget: 80000, cpm: 1.75, budgetRange: "$40K–$80K" },
  { label: "Tier 4", minBudget: 80000, maxBudget: Infinity, cpm: 1.5, budgetRange: "$80K+" },
] as const;

export function getActiveTier(budget: number) {
  return CPM_TIERS.find(
    (t) => budget >= t.minBudget && (t.maxBudget === Infinity || budget < t.maxBudget)
  ) ?? null;
}

export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "twitter", label: "Twitter / X" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
  { key: "other", label: "Other" },
] as const;

export const INTAKE_STEPS = [
  { key: "brand", label: "Brand Info", icon: "solar:buildings-bold-duotone" },
  { key: "socials", label: "Social Accounts", icon: "solar:share-circle-bold-duotone" },
  { key: "icps", label: "Ideal Customers", icon: "solar:users-group-rounded-bold-duotone" },
  { key: "budget", label: "Budget", icon: "solar:wallet-money-bold-duotone" },
  { key: "review", label: "Review & Submit", icon: "solar:check-read-bold-duotone" },
];

export const emptySocial = (): CompanySocial => ({
  platform: "instagram",
  url: "",
});

export const emptyCompetitor = (): CompetitorSocial => ({
  companyName: "",
  accounts: [{ platform: "instagram", url: "" }],
});

export const emptyICP = (): ICP => ({
  name: "",
  description: "",
  demographics: "",
  painPoints: [],
});
