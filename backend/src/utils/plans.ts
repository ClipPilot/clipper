export type PlanType = "free" | "studio" | "scale" | "enterprise";

const PAID_PLANS: PlanType[] = ["studio", "scale", "enterprise"];
const TEAM_INVITE_PLANS: PlanType[] = ["scale", "enterprise"];
const UGC_STUDIO_PLANS: PlanType[] = ["free", "studio", "scale", "enterprise"];

export function isPaidPlan(plan: string | undefined | null): boolean {
  return PAID_PLANS.includes(plan as PlanType);
}

export function canInviteMembers(plan: string | undefined | null): boolean {
  return TEAM_INVITE_PLANS.includes(plan as PlanType);
}

export function canAccessUGCStudio(plan: string | undefined | null): boolean {
  return UGC_STUDIO_PLANS.includes(plan as PlanType);
}
