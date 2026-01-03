import { db } from "../db";
import { referralCodes, referrals, teams, teamMembers, users } from "@clipper/shared-db/src/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { emailNotiService } from "./emailNoti.service";

const FRONTEND_URL = process.env.FRONTEND_URL || "https://platform.cuttr.com";
const ADMIN_EMAIL = "contact@cuttr.com";

class ReferralService {
  private generateRandomId(length: number = 8): string {
    return crypto.randomBytes(length).toString("base64url").slice(0, length);
  }

  async generateCode(teamId: number): Promise<{ id: number; code: string }> {
    const code = `CUTTR-${this.generateRandomId(8).toUpperCase()}`;

    const [newCode] = await db
      .insert(referralCodes)
      .values({
        code,
        created_by_team_id: teamId,
      })
      .returning({ id: referralCodes.id, code: referralCodes.code });

    return newCode;
  }

  async getCodeByTeamId(teamId: number) {
    const [code] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.created_by_team_id, teamId))
      .orderBy(desc(referralCodes.created_at))
      .limit(1);

    return code || null;
  }

  async getCodeByCode(code: string) {
    const [referralCode] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.code, code.toUpperCase()))
      .limit(1);

    return referralCode || null;
  }

  async applyReferralCode(referredTeamId: number, code: string): Promise<boolean> {
    const referralCode = await this.getCodeByCode(code);
    if (!referralCode) return false;

    if (referralCode.created_by_team_id === referredTeamId) return false;

    const [existing] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referred_team_id, referredTeamId))
      .limit(1);

    if (existing) return false;

    await db.insert(referrals).values({
      referral_code_id: referralCode.id,
      referred_team_id: referredTeamId,
      status: "pending",
    });

    const referrerTeam = await this.getTeamWithOwner(referralCode.created_by_team_id);
    const referredTeam = await this.getTeamWithOwner(referredTeamId);

    if (referrerTeam?.ownerEmail) {
      try {
        await emailNotiService.sendReferralApplied(referrerTeam.ownerEmail, {
          referrerName: referrerTeam.ownerName || "there",
          referredTeamName: referredTeam?.teamName || "A new team",
        });
      } catch (err) {
        console.error("Failed to send referral applied email:", err);
      }
    }

    return true;
  }

  async activateReferral(referredTeamId: number, plan: string): Promise<void> {
    await db
      .update(referrals)
      .set({
        status: "active",
        referred_plan: plan,
        updated_at: new Date(),
      })
      .where(eq(referrals.referred_team_id, referredTeamId));

    const [referral] = await db
      .select({
        id: referrals.id,
        referralCodeId: referrals.referral_code_id,
      })
      .from(referrals)
      .where(eq(referrals.referred_team_id, referredTeamId))
      .limit(1);

    if (referral) {
      const [referralCode] = await db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.id, referral.referralCodeId))
        .limit(1);

      if (referralCode) {
        const referrerTeam = await this.getTeamWithOwner(referralCode.created_by_team_id);
        const referredTeam = await this.getTeamWithOwner(referredTeamId);

        try {
          await emailNotiService.sendReferralSuccess(ADMIN_EMAIL, {
            referrerTeamName: referrerTeam?.teamName || "Unknown",
            referrerEmail: referrerTeam?.ownerEmail || "Unknown",
            referredTeamName: referredTeam?.teamName || "Unknown",
            referredEmail: referredTeam?.ownerEmail || "Unknown",
            plan,
          });
        } catch (err) {
          console.error("Failed to send admin referral notification:", err);
        }

        if (referrerTeam?.ownerEmail) {
          try {
            await emailNotiService.sendReferralConverted(referrerTeam.ownerEmail, {
              referrerName: referrerTeam.ownerName || "there",
              referredTeamName: referredTeam?.teamName || "A team",
              plan,
            });
          } catch (err) {
            console.error("Failed to send referral converted email:", err);
          }
        }
      }
    }
  }

  async getReferralsByTeam(teamId: number) {
    const [code] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.created_by_team_id, teamId))
      .orderBy(desc(referralCodes.created_at))
      .limit(1);

    if (!code) return { code: null, referrals: [] };

    const referralsList = await db
      .select({
        id: referrals.id,
        referredTeamId: referrals.referred_team_id,
        referredPlan: referrals.referred_plan,
        status: referrals.status,
        percentOff: referrals.percent_off,
        bonusClips: referrals.bonus_clips,
        rewardApplied: referrals.reward_applied,
        createdAt: referrals.created_at,
      })
      .from(referrals)
      .where(eq(referrals.referral_code_id, code.id))
      .orderBy(desc(referrals.created_at));

    const referralsWithDetails = await Promise.all(
      referralsList.map(async (ref) => {
        const teamDetails = await this.getTeamWithOwner(ref.referredTeamId);
        return {
          ...ref,
          referredTeamName: teamDetails?.teamName || null,
          referredEmail: teamDetails?.ownerEmail || null,
        };
      })
    );

    return { code, referrals: referralsWithDetails };
  }

  async getReferralStats(teamId: number) {
    const { referrals: refs } = await this.getReferralsByTeam(teamId);

    const activeReferrals = refs.filter((r) => r.status === "active");
    const totalBonusClips = activeReferrals.reduce(
      (sum, r) => sum + (r.bonusClips || 0),
      0
    );
    const totalPercentOff = activeReferrals.reduce(
      (sum, r) => sum + parseFloat(r.percentOff || "0"),
      0
    );

    return {
      totalReferrals: refs.length,
      activeReferrals: activeReferrals.length,
      pendingReferrals: refs.filter((r) => r.status === "pending").length,
      totalBonusClips,
      totalPercentOff: Math.min(totalPercentOff, 100),
    };
  }

  async getPendingRewardsForTeam(teamId: number) {
    const [code] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.created_by_team_id, teamId))
      .limit(1);

    if (!code) return { bonusClips: 0, percentOff: 0 };

    const pendingRewards = await db
      .select({
        bonusClips: referrals.bonus_clips,
        percentOff: referrals.percent_off,
      })
      .from(referrals)
      .where(
        and(
          eq(referrals.referral_code_id, code.id),
          eq(referrals.status, "active"),
          eq(referrals.reward_applied, false)
        )
      );

    const totalBonusClips = pendingRewards.reduce(
      (sum, r) => sum + (r.bonusClips || 0),
      0
    );
    const totalPercentOff = pendingRewards.reduce(
      (sum, r) => sum + parseFloat(r.percentOff || "0"),
      0
    );

    return {
      bonusClips: totalBonusClips,
      percentOff: Math.min(totalPercentOff, 100),
    };
  }

  async getAccumulatedPercentOff(teamId: number): Promise<number> {
    const [code] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.created_by_team_id, teamId))
      .limit(1);

    if (!code) return 0;

    const activeReferrals = await db
      .select({ percentOff: referrals.percent_off })
      .from(referrals)
      .where(
        and(
          eq(referrals.referral_code_id, code.id),
          eq(referrals.status, "active")
        )
      );

    const totalPercentOff = activeReferrals.reduce(
      (sum, r) => sum + parseFloat(r.percentOff || "0"),
      0
    );

    return Math.min(totalPercentOff, 100);
  }

  async applyBonusClipsOnRenewal(teamId: number): Promise<number> {
    const [code] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.created_by_team_id, teamId))
      .limit(1);

    if (!code) return 0;

    const pendingRewards = await db
      .select({
        id: referrals.id,
        bonusClips: referrals.bonus_clips,
      })
      .from(referrals)
      .where(
        and(
          eq(referrals.referral_code_id, code.id),
          eq(referrals.status, "active"),
          eq(referrals.reward_applied, false)
        )
      );

    const totalBonusClips = pendingRewards.reduce(
      (sum, r) => sum + (r.bonusClips || 0),
      0
    );

    if (totalBonusClips > 0) {
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      const currentAddon = team?.addon_clips_remaining || 0;

      await db
        .update(teams)
        .set({
          addon_clips_remaining: currentAddon + totalBonusClips,
          updated_at: new Date(),
        })
        .where(eq(teams.id, teamId));

      for (const reward of pendingRewards) {
        if (reward.bonusClips > 0) {
          await db
            .update(referrals)
            .set({ reward_applied: true, updated_at: new Date() })
            .where(eq(referrals.id, reward.id));
        }
      }
    }

    return totalBonusClips;
  }

  private async getTeamWithOwner(teamId: number) {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
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

  async getAllReferralsAdmin() {
    const allReferrals = await db
      .select({
        id: referrals.id,
        referralCodeId: referrals.referral_code_id,
        referredTeamId: referrals.referred_team_id,
        referredPlan: referrals.referred_plan,
        status: referrals.status,
        percentOff: referrals.percent_off,
        bonusClips: referrals.bonus_clips,
        rewardApplied: referrals.reward_applied,
        createdAt: referrals.created_at,
      })
      .from(referrals)
      .orderBy(desc(referrals.created_at));

    const referralsWithDetails = await Promise.all(
      allReferrals.map(async (ref) => {
        const [code] = await db
          .select()
          .from(referralCodes)
          .where(eq(referralCodes.id, ref.referralCodeId))
          .limit(1);

        const referrerTeam = code
          ? await this.getTeamWithOwner(code.created_by_team_id)
          : null;
        const referredTeam = await this.getTeamWithOwner(ref.referredTeamId);

        return {
          ...ref,
          referralCode: code?.code || null,
          referrerTeamId: code?.created_by_team_id || null,
          referrerTeamName: referrerTeam?.teamName || null,
          referrerEmail: referrerTeam?.ownerEmail || null,
          referredTeamName: referredTeam?.teamName || null,
          referredEmail: referredTeam?.ownerEmail || null,
        };
      })
    );

    return referralsWithDetails;
  }

  async setReferralReward(
    referralId: number,
    bonusClips: number,
    percentOff: number
  ): Promise<boolean> {
    const [referral] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.id, referralId))
      .limit(1);

    if (!referral) return false;

    await db
      .update(referrals)
      .set({
        bonus_clips: bonusClips,
        percent_off: percentOff.toString(),
        reward_applied: false,
        updated_at: new Date(),
      })
      .where(eq(referrals.id, referralId));

    const [code] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.id, referral.referral_code_id))
      .limit(1);

    if (code) {
      const referrerTeam = await this.getTeamWithOwner(code.created_by_team_id);

      if (referrerTeam?.ownerEmail) {
        try {
          await emailNotiService.sendReferralRewardSet(referrerTeam.ownerEmail, {
            referrerName: referrerTeam.ownerName || "there",
            bonusClips,
            percentOff,
          });
        } catch (err) {
          console.error("Failed to send reward set email:", err);
        }
      }
    }

    return true;
  }
}

export const referralService = new ReferralService();
