export type PlanType =
  | "free" | "creator" | "studio" | "scale" | "enterprise"
  | "analytics_starter" | "analytics_pro" | "analytics_business";

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
