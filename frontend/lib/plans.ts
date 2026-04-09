export type PlanType =
  | "free" | "creator" | "studio" | "scale" | "enterprise"
  | "analytics_starter" | "analytics_pro" | "analytics_business";

export function getPlanName(plan: string | undefined | null): string {
  switch (plan) {
    case "enterprise": return "Enterprise";
    case "scale": return "Scale";
    case "studio": return "Studio";
    case "creator": return "Creator";
    case "analytics_starter": return "Analytics Starter";
    case "analytics_pro": return "Analytics Pro";
    case "analytics_business": return "Analytics Business";
    default: return "Free";
  }
}

export function getPlanColor(plan: string | undefined | null): string {
  switch (plan) {
    case "enterprise": return "bg-emerald-500/10 text-emerald-500";
    case "scale": return "bg-purple-500/10 text-purple-500";
    case "studio": return "bg-accent-400/10 text-accent-400";
    case "creator": return "bg-orange-500/10 text-orange-500";
    case "analytics_starter":
    case "analytics_pro":
    case "analytics_business": return "bg-cyan-500/10 text-cyan-500";
    default: return "bg-blue-500/10 text-blue-500";
  }
}

const PAID_PLANS: PlanType[] = ["creator", "studio", "scale", "enterprise", "analytics_starter", "analytics_pro", "analytics_business"];
const TEAM_INVITE_PLANS: PlanType[] = ["scale", "enterprise"];
const UGC_STUDIO_PLANS: PlanType[] = ["free", "creator", "studio", "scale", "enterprise"];
const VIRALITY_TRACKER_PLANS: PlanType[] = ["studio", "scale", "enterprise", "analytics_starter", "analytics_pro", "analytics_business"];
const MASS_POSTING_PLANS: PlanType[] = ["studio", "scale", "enterprise"];
const ANALYTICS_PLANS: PlanType[] = ["analytics_starter", "analytics_pro", "analytics_business"];
const MAIN_PLATFORM_PLANS: PlanType[] = ["studio", "scale", "enterprise"];

const VIRALITY_ACCOUNT_LIMITS: Partial<Record<PlanType, number>> = {
  analytics_starter: 50,
  analytics_pro: 100,
  analytics_business: 250,
};

export function isPaidPlan(plan: string | undefined | null): boolean {
  return PAID_PLANS.includes(plan as PlanType);
}

export function canInviteMembers(plan: string | undefined | null): boolean {
  return TEAM_INVITE_PLANS.includes(plan as PlanType);
}

export function canAccessUGCStudio(plan: string | undefined | null): boolean {
  return UGC_STUDIO_PLANS.includes(plan as PlanType);
}

export function canAccessViralityTracker(plan: string | undefined | null): boolean {
  return VIRALITY_TRACKER_PLANS.includes(plan as PlanType);
}

export function canAccessMassPosting(plan: string | undefined | null): boolean {
  return MASS_POSTING_PLANS.includes(plan as PlanType);
}

export function isAnalyticsPlan(plan: string | undefined | null): boolean {
  return ANALYTICS_PLANS.includes(plan as PlanType);
}

export function isMainPlatformPlan(plan: string | undefined | null): boolean {
  return MAIN_PLATFORM_PLANS.includes(plan as PlanType);
}

export function getViralityAccountLimit(plan: string | undefined | null): number {
  if (!plan) return 0;
  const limit = VIRALITY_ACCOUNT_LIMITS[plan as PlanType];
  if (limit !== undefined) return limit;
  if (canAccessViralityTracker(plan)) return -1;
  return 0;
}
