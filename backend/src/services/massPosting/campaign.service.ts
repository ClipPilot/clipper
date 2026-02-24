import {
  campaigns,
  intakeForms,
  teams,
  teamMembers,
  users,
} from "@clipper/shared-db";
import { db } from "../../db";
import { eq, desc, sql, and, or } from "drizzle-orm";
import { googleDriveService } from "../google/drive.service";
import { emailNotiService } from "../emailNoti.service";
import { campaignContractService } from "./campaignContract.service";
import { campaignVideoService } from "./campaignVideo.service";
import { campaignBillingService } from "./campaignBilling.service";

class CampaignService {
  async createCampaign(
    teamId: number,
    formData: {
      brand_description?: string;
      company_website_url?: string;
      icps?: any;
      company_socials?: any;
      competitor_socials?: any;
    },
    budget?: number,
    name?: string,
  ) {
    // Upsert the intake form with completed = true
    const existing = await db
      .select()
      .from(intakeForms)
      .where(eq(intakeForms.team_id, teamId))
      .limit(1);

    let form;
    if (existing[0]) {
      const [updated] = await db
        .update(intakeForms)
        .set({ ...formData, completed: true, updated_at: new Date() })
        .where(eq(intakeForms.team_id, teamId))
        .returning();
      form = updated;
    } else {
      const [created] = await db
        .insert(intakeForms)
        .values({ team_id: teamId, ...formData, completed: true })
        .returning();
      form = created;
    }

    // Get team name for default campaign naming
    const [team] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    const campaignName = name || `${team?.name || "Team"} Campaign`;

    const [campaign] = await db
      .insert(campaigns)
      .values({
        team_id: teamId,
        intake_form_id: form.id,
        name: campaignName,
        status: "pending",
        budget: budget != null ? budget.toString() : null,
      })
      .returning();

    return campaign;
  }

  async getCampaignsForTeam(
    teamId: number,
    options?: { status?: string; limit?: number; offset?: number },
  ) {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const conditions = [eq(campaigns.team_id, teamId)];
    if (options?.status) {
      conditions.push(eq(campaigns.status, options.status as any));
    }

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(campaigns)
        .where(and(...conditions))
        .orderBy(desc(campaigns.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(campaigns)
        .where(and(...conditions)),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      campaigns: rows,
      total,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    };
  }

  async getCampaignById(campaignId: number) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    return campaign || null;
  }

  async getCampaignForTeamById(teamId: number, campaignId: number) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(
        and(eq(campaigns.id, campaignId), eq(campaigns.team_id, teamId)),
      )
      .limit(1);

    return campaign || null;
  }

  async submitAppeal(
    teamId: number,
    campaignId: number,
    formData: {
      brand_description?: string;
      company_website_url?: string;
      icps?: any;
      company_socials?: any;
      competitor_socials?: any;
    },
  ) {
    const campaign = await this.getCampaignForTeamById(teamId, campaignId);
    if (!campaign || campaign.status !== "rejected") {
      throw new Error("Can only appeal a rejected campaign");
    }

    // Update the intake form with new data
    if (campaign.intake_form_id) {
      await db
        .update(intakeForms)
        .set({ ...formData, completed: true, updated_at: new Date() })
        .where(eq(intakeForms.id, campaign.intake_form_id));
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: "appeal", updated_at: new Date() })
      .where(eq(campaigns.id, campaignId))
      .returning();

    return updated;
  }

  // ── Admin Operations ───────────────────────────

  async approveCampaign(
    id: number,
    quotedCpm: string,
    videoMinimum: number,
    adminNotes?: string,
  ) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const updateData: Record<string, any> = {
      status: "accepted",
      quoted_cpm: quotedCpm,
      video_minimum: videoMinimum,
      updated_at: new Date(),
    };

    if (adminNotes) updateData.admin_notes = adminNotes;

    const [updated] = await db
      .update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, id))
      .returning();

    // Auto-generate contract PDF
    try {
      await campaignContractService.generateContract(id);
    } catch (error) {
      console.error("Failed to auto-generate contract on approval:", error);
    }

    // Send approval email to team owner
    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, campaign.team_id))
        .limit(1);

      const [owner] = await db
        .select({ email: users.email, firstName: users.first_name })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(
          and(
            eq(teamMembers.team_id, campaign.team_id),
            eq(teamMembers.role, "owner"),
          ),
        )
        .limit(1);

      if (owner?.email) {
        const frontendUrl =
          process.env.FRONTEND_URL || "https://platform.cuttr.com";
        await emailNotiService.sendMassPostingApproved(owner.email, {
          userName: owner.firstName || "there",
          teamName: team.name,
          dashboardUrl: `${frontendUrl}/dashboard/publish-posts`,
          driveFolderUrl: "",
        });
      }
    } catch (emailError) {
      console.error("Failed to send campaign approval email:", emailError);
    }

    return updated;
  }

  async rejectCampaign(id: number, reason: string, adminNotes?: string) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const updateData: Record<string, any> = {
      status: "rejected",
      rejection_reason: reason,
      updated_at: new Date(),
    };

    if (adminNotes) updateData.admin_notes = adminNotes;

    const [updated] = await db
      .update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, id))
      .returning();

    // Send rejection email
    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, campaign.team_id))
        .limit(1);

      const [owner] = await db
        .select({ email: users.email, firstName: users.first_name })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(
          and(
            eq(teamMembers.team_id, campaign.team_id),
            eq(teamMembers.role, "owner"),
          ),
        )
        .limit(1);

      if (owner?.email) {
        const frontendUrl =
          process.env.FRONTEND_URL || "https://platform.cuttr.com";
        await emailNotiService.sendMassPostingRejected(owner.email, {
          userName: owner.firstName || "there",
          teamName: team.name,
          rejectionReason: reason,
          reapplyUrl: `${frontendUrl}/dashboard/publish-posts`,
        });
      }
    } catch (emailError) {
      console.error("Failed to send campaign rejection email:", emailError);
    }

    return updated;
  }

  async updateCampaign(
    id: number,
    data: { quotedCpm?: string; videoMinimum?: number; adminNotes?: string },
  ) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const updateData: Record<string, any> = { updated_at: new Date() };
    if (data.quotedCpm !== undefined) updateData.quoted_cpm = data.quotedCpm;
    if (data.videoMinimum !== undefined) updateData.video_minimum = data.videoMinimum;
    if (data.adminNotes !== undefined) updateData.admin_notes = data.adminNotes;

    const [updated] = await db
      .update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, id))
      .returning();

    return updated;
  }

  async pauseCampaign(id: number) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.status !== "started") {
      throw new Error("Can only pause a started campaign");
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: "paused", updated_at: new Date() })
      .where(eq(campaigns.id, id))
      .returning();

    return updated;
  }

  async checkGates(campaignId: number) {
    const campaign = await this.getCampaignById(campaignId);
    if (!campaign) throw new Error("Campaign not found");

    return {
      videosReady: campaign.videos_ready,
      paymentReady: campaign.payment_ready,
      contractReady: campaign.contract_ready,
    };
  }

  async startCampaign(teamId: number, campaignId: number) {
    const campaign = await this.getCampaignForTeamById(teamId, campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.status !== "accepted") {
      throw new Error("Campaign must be accepted before starting");
    }

    // Validate all gates
    if (!campaign.videos_ready || !campaign.payment_ready || !campaign.contract_ready) {
      throw new Error("All gates must be completed before starting the campaign");
    }

    // Create Drive folder if not already created
    let driveFolderId = campaign.google_drive_folder_id;
    if (!driveFolderId) {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      try {
        driveFolderId = await googleDriveService.createTeamFolder(
          `${team.name} - ${campaign.name}`,
          teamId,
        );
      } catch (error) {
        console.error("Failed to create campaign Drive folder:", error);
        throw new Error("Failed to create Google Drive folder for campaign");
      }
    }

    const [updated] = await db
      .update(campaigns)
      .set({
        status: "started",
        google_drive_folder_id: driveFolderId,
        started_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(campaigns.id, campaignId))
      .returning();

    return updated;
  }
}

export const campaignService = new CampaignService();
