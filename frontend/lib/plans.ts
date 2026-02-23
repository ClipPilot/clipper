export type PlanType = "free" | "creator" | "studio" | "scale" | "enterprise";

/**
 * Returns the display name for a plan slug.
 */
export function getPlanName(plan: string | undefined | null): string {
  switch (plan) {
    case "enterprise": return "Enterprise";
    case "scale": return "Scale";
    case "studio": return "Studio";
    case "creator": return "Creator";
    default: return "Free";
  }
}

/**
 * Returns a Tailwind badge class pair (bg + text) for a plan slug.
 */
export function getPlanColor(plan: string | undefined | null): string {
  switch (plan) {
    case "enterprise": return "bg-emerald-500/10 text-emerald-500";
    case "scale": return "bg-purple-500/10 text-purple-500";
    case "studio": return "bg-accent-400/10 text-accent-400";
    case "creator": return "bg-orange-500/10 text-orange-500";
    default: return "bg-blue-500/10 text-blue-500";
  }
}

const PAID_PLANS: PlanType[] = ["creator", "studio", "scale", "enterprise"];
const TEAM_INVITE_PLANS: PlanType[] = ["scale", "enterprise"];
const UGC_STUDIO_PLANS: PlanType[] = ["free", "creator", "studio", "scale", "enterprise"];
const VIRALITY_TRACKER_PLANS: PlanType[] = ["studio", "scale", "enterprise"];
const MASS_POSTING_PLANS: PlanType[] = ["studio", "scale", "enterprise"];

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
