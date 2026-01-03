import { ReferralCode, Referral, ReferralStats } from "@/types/referral";

export const mockReferralCodes: ReferralCode[] = [
  {
    id: "1",
    code: "CUTTR-ABC123",
    createdAt: "2024-12-01T10:00:00Z",
    isActive: true,
  },
];

export const mockReferrals: Referral[] = [
  {
    id: "1",
    referralCodeId: "1",
    refereeName: "Jane Smith",
    refereeEmail: "jane@company.com",
    plan: "scale",
    status: "active",
    signedUpAt: "2024-12-15T14:30:00Z",
    monthlyBenefit: 150,
  },
  {
    id: "2",
    referralCodeId: "1",
    refereeName: "Acme Corp",
    refereeEmail: "billing@acme.com",
    plan: "enterprise",
    status: "active",
    signedUpAt: "2024-12-20T09:00:00Z",
    monthlyBenefit: 10,
  },
];

export const mockReferralStats: ReferralStats = {
  totalReferrals: 2,
  activeReferrals: 2,
  monthlyCreditsEarned: 150,
  totalCreditsEarned: 300,
  discountPercentage: 10,
};

export function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "CUTTR-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
