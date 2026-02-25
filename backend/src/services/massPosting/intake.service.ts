import { campaigns, intakeForms, teams } from "@clipper/shared-db";
import { db } from "../../db";
import { eq, desc } from "drizzle-orm";

interface IntakeFormData {
  brand_description?: string;
  company_website_url?: string;
  icps?: any;
  company_socials?: any;
  competitor_socials?: any;
  completed?: boolean;
}

class IntakeService {
  // ── Form CRUD ──────────────────────────────────

  async getIntakeForm(teamId: number) {
    const [form] = await db
      .select()
      .from(intakeForms)
      .where(eq(intakeForms.team_id, teamId))
      .limit(1);

    return form || null;
  }

  async upsertIntakeForm(teamId: number, data: IntakeFormData) {
    const existing = await this.getIntakeForm(teamId);

    if (existing) {
      const [updated] = await db
        .update(intakeForms)
        .set({ ...data, updated_at: new Date() })
        .where(eq(intakeForms.team_id, teamId))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(intakeForms)
      .values({ team_id: teamId, ...data })
      .returning();
    return created;
  }

  // ── Application Lifecycle (now creates campaigns) ──

  async submitApplication(teamId: number, formData: IntakeFormData, budget?: number, name?: string) {
    // Block if already pending or accepted
    const latest = await this.getLatestCampaign(teamId);
    if (
      latest &&
      (latest.status === "pending" || latest.status === "accepted")
    ) {
      throw new Error(
        latest.status === "pending"
          ? "You already have a pending application"
          : "Your application has already been accepted",
      );
    }

    // Upsert the intake form with completed = true
    const form = await this.upsertIntakeForm(teamId, {
      ...formData,
      completed: true,
    });

    // Get team name for campaign naming
    const [team] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    const campaignName = name || `${team?.name || "Team"} Campaign`;

    // Create a campaign
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

  async submitAppeal(teamId: number, formData: IntakeFormData, budget?: number) {
    const latest = await this.getLatestCampaign(teamId);
    if (!latest || latest.status !== "rejected") {
      throw new Error("Can only appeal a rejected application");
    }

    // Update the intake form with new data
    const form = await this.upsertIntakeForm(teamId, {
      ...formData,
      completed: true,
    });

    // Update the campaign status to appeal
    const [updated] = await db
      .update(campaigns)
      .set({
        status: "appeal",
        intake_form_id: form.id,
        budget: budget != null ? budget.toString() : null,
        updated_at: new Date(),
      })
      .where(eq(campaigns.id, latest.id))
      .returning();

    return updated;
  }

  async getLatestCampaign(teamId: number) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.team_id, teamId))
      .orderBy(desc(campaigns.created_at))
      .limit(1);

    return campaign || null;
  }

  async getApplicationStatus(teamId: number) {
    const form = await this.getIntakeForm(teamId);
    const latest = await this.getLatestCampaign(teamId);

    return {
      hasIntakeForm: !!form,
      intakeFormCompleted: form?.completed ?? false,
      applicationStatus: latest?.status || null,
      googleDriveFolderId: latest?.google_drive_folder_id || null,
    };
  }

}

export const intakeService = new IntakeService();
