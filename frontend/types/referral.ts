export type ReferralPlan = "studio" | "scale" | "enterprise";

export interface ReferralCode {
  id: string;
  code: string;
  createdAt: string;
  isActive: boolean;
}

export interface Referral {
  id: string;
  referralCodeId: string;
  refereeName: string;
  refereeEmail: string;
  plan: ReferralPlan;
  status: "pending" | "active" | "churned";
  signedUpAt: string;
  monthlyBenefit: number;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  monthlyCreditsEarned: number;
  totalCreditsEarned: number;
  discountPercentage: number;
}

export const REFERRAL_BENEFITS = {
  enterprise: {
    type: "discount" as const,
    value: 10,
    description: "10% off for as long as they are a customer",
  },
  scale: {
    type: "credits" as const,
    value: 150,
    description: "150 bonus credits each month",
  },
  studio: {
    type: "credits" as const,
    value: 100,
    description: "100 bonus credits each month",
  },
} as const;
