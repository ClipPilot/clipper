export type PlanType = "free" | "creator" | "studio" | "scale" | "enterprise";

const PAID_PLANS: PlanType[] = ["creator", "studio", "scale", "enterprise"];
const TEAM_INVITE_PLANS: PlanType[] = ["scale", "enterprise"];
const UGC_STUDIO_PLANS: PlanType[] = ["free", "creator", "studio", "scale", "enterprise"];
const VIRALITY_TRACKER_PLANS: PlanType[] = ["studio", "scale", "enterprise"];

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
  return PAID_PLANS.includes(plan as PlanType);
}
