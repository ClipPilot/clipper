import {
  massPostingApplications,
  intakeForms,
  teams,
  teamMembers,
  users,
} from "@clipper/shared-db";
import { db } from "../../db";
import { eq, desc, sql, and } from "drizzle-orm";
import { googleDriveService } from "../google/drive.service";
import { emailNotiService } from "../emailNoti.service";

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

  // ── Application Lifecycle ──────────────────────

  async submitApplication(teamId: number, formData: IntakeFormData, budget?: number) {
    // Block if already pending or accepted
    const latest = await this.getLatestApplication(teamId);
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

    // Create the application
    const [application] = await db
      .insert(massPostingApplications)
      .values({
        team_id: teamId,
        intake_form_id: form.id,
        status: "pending",
        budget: budget != null ? budget.toString() : null,
      })
      .returning();

    return application;
  }

  async submitAppeal(teamId: number, formData: IntakeFormData, budget?: number) {
    const latest = await this.getLatestApplication(teamId);
    if (!latest || latest.status !== "rejected") {
      throw new Error("Can only appeal a rejected application");
    }

    // Update the intake form with new data
    const form = await this.upsertIntakeForm(teamId, {
      ...formData,
      completed: true,
    });

    const [application] = await db
      .insert(massPostingApplications)
      .values({
        team_id: teamId,
        intake_form_id: form.id,
        status: "appeal",
        budget: budget != null ? budget.toString() : null,
      })
      .returning();

    return application;
  }

  async updateApplicationCPM(id: number, quotedCpm: string, videoMinimum?: number) {
    const [application] = await db
      .select()
      .from(massPostingApplications)
      .where(eq(massPostingApplications.id, id))
      .limit(1);

    if (!application) {
      throw new Error("Application not found");
    }

    const updateData: Record<string, any> = {
      quoted_cpm: quotedCpm,
      updated_at: new Date(),
    };
    if (videoMinimum != null) updateData.videoMinimum = videoMinimum;

    const [updated] = await db
      .update(massPostingApplications)
      .set(updateData)
      .where(eq(massPostingApplications.id, id))
      .returning();

    return updated;
  }

  async getLatestApplication(teamId: number) {
    const [application] = await db
      .select()
      .from(massPostingApplications)
      .where(eq(massPostingApplications.team_id, teamId))
      .orderBy(desc(massPostingApplications.created_at))
      .limit(1);

    return application || null;
  }

  async getApplicationStatus(teamId: number) {
    const form = await this.getIntakeForm(teamId);
    const latest = await this.getLatestApplication(teamId);

    return {
      hasIntakeForm: !!form,
      intakeFormCompleted: form?.completed ?? false,
      applicationStatus: latest?.status || null,
      googleDriveFolderId: latest?.google_drive_folder_id || null,
    };
  }

  // ── Admin Operations ───────────────────────────

  async getAllApplications(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = options?.limit ?? 10;
    const offset = options?.offset ?? 0;

    const conditions = options?.status
      ? eq(massPostingApplications.status, options.status)
      : undefined;

    const [applicationRows, countResult] = await Promise.all([
      db
        .select({
          id: massPostingApplications.id,
          team_id: massPostingApplications.team_id,
          status: massPostingApplications.status,
          google_drive_folder_id:
            massPostingApplications.google_drive_folder_id,
          rejection_reason: massPostingApplications.rejection_reason,
          admin_notes: massPostingApplications.admin_notes,
          created_at: massPostingApplications.created_at,
          updated_at: massPostingApplications.updated_at,
          budget: massPostingApplications.budget,
          quoted_cpm: massPostingApplications.quoted_cpm,
          video_minimum: massPostingApplications.videoMinimum,
          team_name: teams.name,
          team_plan: teams.plan,
        })
        .from(massPostingApplications)
        .innerJoin(teams, eq(massPostingApplications.team_id, teams.id))
        .where(conditions)
        .orderBy(desc(massPostingApplications.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(massPostingApplications)
        .where(conditions),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      applications: applicationRows,
      total,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    };
  }

  async getApplicationById(id: number) {
    const [application] = await db
      .select({
        id: massPostingApplications.id,
        team_id: massPostingApplications.team_id,
        intake_form_id: massPostingApplications.intake_form_id,
        status: massPostingApplications.status,
        details: massPostingApplications.details,
        google_drive_folder_id: massPostingApplications.google_drive_folder_id,
        rejection_reason: massPostingApplications.rejection_reason,
        admin_notes: massPostingApplications.admin_notes,
        created_at: massPostingApplications.created_at,
        updated_at: massPostingApplications.updated_at,
        budget: massPostingApplications.budget,
        quoted_cpm: massPostingApplications.quoted_cpm,
        video_minimum: massPostingApplications.videoMinimum,
        team_name: teams.name,
        team_plan: teams.plan,
      })
      .from(massPostingApplications)
      .innerJoin(teams, eq(massPostingApplications.team_id, teams.id))
      .where(eq(massPostingApplications.id, id))
      .limit(1);

    if (!application) {
      throw new Error("Application not found");
    }

    // Fetch associated intake form if linked
    let intakeForm: typeof intakeForms.$inferSelect | null = null;
    if (application.intake_form_id) {
      const [foundForm] = await db
        .select()
        .from(intakeForms)
        .where(eq(intakeForms.id, application.intake_form_id))
        .limit(1);
      intakeForm = foundForm ?? null;
    }

    return { ...application, intakeForm };
  }

  async approveApplication(id: number, adminNotes?: string) {
    const [application] = await db
      .select()
      .from(massPostingApplications)
      .where(eq(massPostingApplications.id, id))
      .limit(1);

    if (!application) {
      throw new Error("Application not found");
    }

    // Get team info for folder naming
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, application.team_id))
      .limit(1);

    let googleDriveFolderId: string | null = null;

    // Try to create Drive folder, but don't block approval on failure
    try {
      googleDriveFolderId = await googleDriveService.createTeamFolder(
        team.name,
        team.id,
      );
    } catch (error) {
      console.error("Failed to create Google Drive folder:", error);
    }

    const updateData: Record<string, any> = {
      status: "accepted",
      updated_at: new Date(),
    };

    if (adminNotes) updateData.admin_notes = adminNotes;
    if (googleDriveFolderId)
      updateData.google_drive_folder_id = googleDriveFolderId;

    const [updated] = await db
      .update(massPostingApplications)
      .set(updateData)
      .where(eq(massPostingApplications.id, id))
      .returning();

    // Send approval email to team owner if Drive folder was created
    if (googleDriveFolderId) {
      try {
        const [owner] = await db
          .select({ email: users.email, firstName: users.first_name })
          .from(teamMembers)
          .innerJoin(users, eq(teamMembers.user_id, users.id))
          .where(
            and(
              eq(teamMembers.team_id, application.team_id),
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
            dashboardUrl: `${frontendUrl}/dashboard/mass-posting`,
            driveFolderUrl: googleDriveService.getFolderLink(googleDriveFolderId),
          });
        }
      } catch (emailError) {
        console.error("Failed to send mass posting approval email:", emailError);
      }
    }

    return updated;
  }

  async rejectApplication(id: number, reason: string, adminNotes?: string) {
    const [application] = await db
      .select()
      .from(massPostingApplications)
      .where(eq(massPostingApplications.id, id))
      .limit(1);

    if (!application) {
      throw new Error("Application not found");
    }

    const updateData: Record<string, any> = {
      status: "rejected",
      rejection_reason: reason,
      updated_at: new Date(),
    };

    if (adminNotes) updateData.admin_notes = adminNotes;

    const [updated] = await db
      .update(massPostingApplications)
      .set(updateData)
      .where(eq(massPostingApplications.id, id))
      .returning();

    // Send rejection email to team owner
    try {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, application.team_id))
        .limit(1);

      const [owner] = await db
        .select({ email: users.email, firstName: users.first_name })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(
          and(
            eq(teamMembers.team_id, application.team_id),
            eq(teamMembers.role, "owner"),
          ),
        )
        .limit(1);

      if (owner?.email) {
        const frontendUrl = process.env.FRONTEND_URL || "https://platform.cuttr.com";
        await emailNotiService.sendMassPostingRejected(owner.email, {
          userName: owner.firstName || "there",
          teamName: team.name,
          rejectionReason: reason,
          reapplyUrl: `${frontendUrl}/dashboard/mass-posting`,
        });
      }
    } catch (emailError) {
      console.error("Failed to send mass posting rejection email:", emailError);
    }

    return updated;
  }

  async retryDriveFolder(id: number) {
    const [application] = await db
      .select()
      .from(massPostingApplications)
      .where(eq(massPostingApplications.id, id))
      .limit(1);

    if (!application) {
      throw new Error("Application not found");
    }

    if (application.status !== "accepted") {
      throw new Error("Can only retry Drive folder for accepted applications");
    }

    if (application.google_drive_folder_id) {
      throw new Error("Drive folder already exists");
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, application.team_id))
      .limit(1);

    const folderId = await googleDriveService.createTeamFolder(
      team.name,
      team.id,
    );

    const [updated] = await db
      .update(massPostingApplications)
      .set({
        google_drive_folder_id: folderId,
        updated_at: new Date(),
      })
      .where(eq(massPostingApplications.id, id))
      .returning();

    return updated;
  }
}

export const intakeService = new IntakeService();
