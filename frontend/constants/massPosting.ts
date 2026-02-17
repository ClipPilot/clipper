import type { CompanySocial, CompetitorSocial, ICP } from "@/types/massPosting";

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
