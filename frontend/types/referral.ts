export type ReferralPlan = "studio" | "scale" | "enterprise" | "free";
export type ReferralStatus = "pending" | "active" | "churned";

export interface ReferralCode {
  id: number;
  code: string;
  createdAt: string;
}

export interface Referral {
  id: number;
  referredTeamId: number;
  referredTeamName: string;
  referredEmail: string;
  referredPlan: ReferralPlan | null;
  status: ReferralStatus;
  percentOff: string;
  bonusClips: number;
  createdAt: string;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  pendingReferrals: number;
  totalBonusClips: number;
  totalPercentOff: number;
}

export const REFERRAL_BENEFITS = {
  enterprise: {
    type: "discount" as const,
    value: 10,
    description: "Up to 10% off every month for as long as they are a customer",
  },
  scale: {
    type: "credits" as const,
    value: 150,
    description: "150 bonus credits",
  },
  studio: {
    type: "credits" as const,
    value: 100,
    description: "100 bonus credits",
  },
} as const;
