import * as Sentry from "@sentry/node";
import { db } from "../db";
import { incidents } from "@clipper/shared-db/src/schema";
import { eq, desc, or, sql, and, gte } from "drizzle-orm";

interface CreateIncidentData {
  title: string;
  status?: "investigating" | "identified" | "monitoring" | "resolved";
  affected_services: string[];
  message: string;
  created_by_admin_email: string;
}

interface AddUpdateData {
  status: "investigating" | "identified" | "monitoring" | "resolved";
  message: string;
}

class IncidentService {
  /**
   * Get active + recently resolved incidents (public, for status page)
   */
  async getActiveIncidents() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const results = await db
        .select()
        .from(incidents)
        .where(
          or(
            // All non-resolved incidents
            sql`${incidents.status} != 'resolved'`,
            // Resolved within last 7 days
            and(
              eq(incidents.status, "resolved"),
              gte(incidents.resolved_at, sevenDaysAgo),
            ),
          ),
        )
        .orderBy(desc(incidents.created_at));

      return results;
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to fetch active incidents");
    }
  }

  /**
   * Get all incidents with optional status filter (Admin)
   */
  async getAllIncidents(filters: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    try {
      const { status, limit = 20, offset = 0 } = filters;

      let query = db.select().from(incidents);

      if (status) {
        query = query.where(
          eq(incidents.status, status as any),
        ) as typeof query;
      }

      const results = await query
        .orderBy(desc(incidents.created_at))
        .limit(limit)
        .offset(offset);

      const totalQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(incidents);

      const totalResult = status
        ? await totalQuery.where(eq(incidents.status, status as any))
        : await totalQuery;

      const total = Number(totalResult[0]?.count || 0);

      return { incidents: results, total };
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to fetch incidents");
    }
  }

  /**
   * Create incident (Admin)
   */
  async createIncident(data: CreateIncidentData) {
    try {
      const initialStatus = data.status || "investigating";
      const now = new Date().toISOString();

      const [incident] = await db
        .insert(incidents)
        .values({
          title: data.title,
          status: initialStatus,
          affected_services: data.affected_services,
          updates: [
            {
              status: initialStatus,
              message: data.message,
              timestamp: now,
            },
          ],
          created_by_admin_email: data.created_by_admin_email,
          resolved_at: initialStatus === "resolved" ? new Date() : null,
        })
        .returning();

      return incident;
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to create incident");
    }
  }

  /**
   * Update incident metadata (Admin)
   */
  async updateIncident(
    id: number,
    updates: { title?: string; affected_services?: string[] },
  ) {
    try {
      const [incident] = await db
        .update(incidents)
        .set({
          ...updates,
          updated_at: new Date(),
        })
        .where(eq(incidents.id, id))
        .returning();

      if (!incident) {
        throw new Error("Incident not found");
      }

      return incident;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Add a status update to an incident (Admin)
   */
  async addUpdate(id: number, data: AddUpdateData) {
    try {
      // Fetch current incident
      const [current] = await db
        .select()
        .from(incidents)
        .where(eq(incidents.id, id))
        .limit(1);

      if (!current) {
        throw new Error("Incident not found");
      }

      const existingUpdates = (current.updates || []) as {
        status: string;
        message: string;
        timestamp: string;
      }[];

      const newUpdate = {
        status: data.status,
        message: data.message,
        timestamp: new Date().toISOString(),
      };

      const [incident] = await db
        .update(incidents)
        .set({
          status: data.status,
          updates: [...existingUpdates, newUpdate],
          resolved_at: data.status === "resolved" ? new Date() : current.resolved_at,
          updated_at: new Date(),
        })
        .where(eq(incidents.id, id))
        .returning();

      return incident;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Delete incident (Admin)
   */
  async deleteIncident(id: number) {
    try {
      await db.delete(incidents).where(eq(incidents.id, id));
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to delete incident");
    }
  }
}

export const incidentService = new IncidentService();
