import { db } from "../db";
import {
  affiliateCodes,
  affiliates,
  affiliateCommissions,
  affiliatePayouts,
  teams,
  teamMembers,
  users,
} from "@clipper/shared-db/src/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";

class AffiliateService {
  private generateRandomCode(length: number = 8): string {
    return crypto.randomBytes(length).toString("base64url").slice(0, length).toUpperCase();
  }

  async generateCode(userId: number): Promise<{ id: number; code: string }> {
    const code = `AFF-${this.generateRandomCode(8)}`;

    const [newCode] = await db
      .insert(affiliateCodes)
      .values({
        code,
        created_by_user_id: userId,
      })
      .returning({ id: affiliateCodes.id, code: affiliateCodes.code });

    return newCode;
  }

  async getCodeByUserId(userId: number) {
    const [code] = await db
      .select()
      .from(affiliateCodes)
      .where(eq(affiliateCodes.created_by_user_id, userId))
      .orderBy(desc(affiliateCodes.created_at))
      .limit(1);

    return code || null;
  }

  async getCodeByCode(code: string) {
    const [affiliateCode] = await db
      .select()
      .from(affiliateCodes)
      .where(eq(affiliateCodes.code, code.toUpperCase()))
      .limit(1);

    return affiliateCode || null;
  }

  async validateCode(code: string): Promise<{ valid: boolean; code?: string }> {
    const upperCode = code.toUpperCase().trim();
    const affiliateCode = await this.getCodeByCode(upperCode);
    if (affiliateCode && affiliateCode.is_active) {
      return { valid: true, code: affiliateCode.code };
    }
    return { valid: false };
  }

  async applyAffiliateCode(referredTeamId: number, code: string): Promise<boolean> {
    const affiliateCode = await this.getCodeByCode(code);
    if (!affiliateCode || !affiliateCode.is_active) return false;

    const [existing] = await db
      .select()
      .from(affiliates)
      .where(eq(affiliates.referred_team_id, referredTeamId))
      .limit(1);

    if (existing) return false;

    await db.insert(affiliates).values({
      affiliate_code_id: affiliateCode.id,
      referred_team_id: referredTeamId,
      status: "pending",
    });

    return true;
  }

  async activateAffiliate(referredTeamId: number, plan: string): Promise<void> {
    await db
      .update(affiliates)
      .set({
        status: "active",
        referred_plan: plan,
        updated_at: new Date(),
      })
      .where(eq(affiliates.referred_team_id, referredTeamId));
  }

  async recordCommission(
    referredTeamId: number,
    invoiceId: string,
    amount: number
  ): Promise<void> {
    const [affiliate] = await db
      .select({
        id: affiliates.id,
        affiliateCodeId: affiliates.affiliate_code_id,
      })
      .from(affiliates)
      .where(
        and(
          eq(affiliates.referred_team_id, referredTeamId),
          eq(affiliates.status, "active")
        )
      )
      .limit(1);

    if (!affiliate) return;

    const [code] = await db
      .select()
      .from(affiliateCodes)
      .where(eq(affiliateCodes.id, affiliate.affiliateCodeId))
      .limit(1);

    if (!code) return;

    const commissionPercent = parseFloat(code.commission_percent || "10");
    const commissionAmount = (amount * commissionPercent) / 100;

    await db.insert(affiliateCommissions).values({
      affiliate_id: affiliate.id,
      invoice_id: invoiceId,
      amount: amount.toString(),
      commission_amount: commissionAmount.toString(),
      commission_percent: commissionPercent.toString(),
    });

    await db
      .update(affiliates)
      .set({
        commission_earned: sql`${affiliates.commission_earned} + ${commissionAmount}`,
        updated_at: new Date(),
      })
      .where(eq(affiliates.id, affiliate.id));
  }

  async getAffiliatedTeams(userId: number) {
    const [code] = await db
      .select()
      .from(affiliateCodes)
      .where(eq(affiliateCodes.created_by_user_id, userId))
      .limit(1);

    if (!code) return { code: null, affiliates: [] };

    const affiliatesList = await db
      .select({
        id: affiliates.id,
        referredTeamId: affiliates.referred_team_id,
        referredPlan: affiliates.referred_plan,
        status: affiliates.status,
        commissionEarned: affiliates.commission_earned,
        createdAt: affiliates.created_at,
        teamName: teams.name,
        teamPlan: teams.plan,
      })
      .from(affiliates)
      .innerJoin(teams, eq(affiliates.referred_team_id, teams.id))
      .where(eq(affiliates.affiliate_code_id, code.id))
      .orderBy(desc(affiliates.created_at));

    return { code, affiliates: affiliatesList };
  }

  async getAffiliateStats(userId: number) {
    const { affiliates: affs } = await this.getAffiliatedTeams(userId);

    const activeAffiliates = affs.filter((a) => a.status === "active");
    const totalCommission = affs.reduce(
      (sum, a) => sum + parseFloat(a.commissionEarned || "0"),
      0
    );

    const unpaidCommission = await this.getUnpaidCommissions(userId);

    return {
      totalAffiliates: affs.length,
      activeAffiliates: activeAffiliates.length,
      pendingAffiliates: affs.filter((a) => a.status === "pending").length,
      totalCommission,
      unpaidCommission,
    };
  }

  async getUnpaidCommissions(userId: number): Promise<number> {
    const [code] = await db
      .select()
      .from(affiliateCodes)
      .where(eq(affiliateCodes.created_by_user_id, userId))
      .limit(1);

    if (!code) return 0;

    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(${affiliateCommissions.commission_amount}), 0)`,
      })
      .from(affiliateCommissions)
      .innerJoin(affiliates, eq(affiliateCommissions.affiliate_id, affiliates.id))
      .where(
        and(
          eq(affiliates.affiliate_code_id, code.id),
          sql`${affiliateCommissions.payout_id} IS NULL`
        )
      );

    return parseFloat(result[0]?.total || "0");
  }

  async becomeAffiliate(userId: number): Promise<boolean> {
    await db
      .update(users)
      .set({ is_affiliate: true, updated_at: new Date() })
      .where(eq(users.id, userId));

    return true;
  }

  async isAffiliate(userId: number): Promise<boolean> {
    const [user] = await db
      .select({ isAffiliate: users.is_affiliate })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user?.isAffiliate || false;
  }

  async getAllAffiliatesAdmin() {
    const allAffiliates = await db
      .select({
        id: affiliates.id,
        affiliateCodeId: affiliates.affiliate_code_id,
        referredTeamId: affiliates.referred_team_id,
        referredPlan: affiliates.referred_plan,
        status: affiliates.status,
        commissionEarned: affiliates.commission_earned,
        payoutSent: affiliates.payout_sent,
        createdAt: affiliates.created_at,
        teamName: teams.name,
        teamPlan: teams.plan,
      })
      .from(affiliates)
      .innerJoin(teams, eq(affiliates.referred_team_id, teams.id))
      .orderBy(desc(affiliates.created_at));

    const affiliatesWithDetails = await Promise.all(
      allAffiliates.map(async (aff) => {
        const [code] = await db
          .select()
          .from(affiliateCodes)
          .where(eq(affiliateCodes.id, aff.affiliateCodeId))
          .limit(1);

        const [affiliateUser] = code
          ? await db
              .select({
                email: users.email,
                firstName: users.first_name,
                lastName: users.last_name,
              })
              .from(users)
              .where(eq(users.id, code.created_by_user_id))
              .limit(1)
          : [null];

        return {
          ...aff,
          affiliateCode: code?.code || null,
          affiliateEmail: affiliateUser?.email || null,
          affiliateName: affiliateUser
            ? `${affiliateUser.firstName} ${affiliateUser.lastName}`
            : null,
          commissionPercent: code?.commission_percent || "10",
        };
      })
    );

    return affiliatesWithDetails;
  }

  async getAffiliateUsersAdmin() {
    return db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.first_name,
        lastName: users.last_name,
        isAffiliate: users.is_affiliate,
        createdAt: users.created_at,
      })
      .from(users)
      .where(eq(users.is_affiliate, true))
      .orderBy(desc(users.created_at));
  }

  private async getTeamWithOwner(teamId: number) {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) return null;

    const [owner] = await db
      .select({
        email: users.email,
        firstName: users.first_name,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.user_id, users.id))
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, "owner")))
      .limit(1);

    return {
      teamId: team.id,
      teamName: team.name,
      ownerEmail: owner?.email || null,
      ownerName: owner?.firstName || null,
    };
  }
}

export const affiliateService = new AffiliateService();
