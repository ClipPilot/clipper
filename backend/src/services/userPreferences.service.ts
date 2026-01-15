import { db } from "../db";
import { userPreferences } from "@clipper/shared-db/src/schema";
import { eq } from "drizzle-orm";

export interface WidgetConfig {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardPreferences {
  dashboardLayout: WidgetConfig[] | null;
  widgetColors: Record<string, string> | null;
}

class UserPreferencesService {
  async getPreferences(userId: number): Promise<DashboardPreferences> {
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.user_id, userId))
      .limit(1);

    return {
      dashboardLayout: (prefs?.dashboard_layout as WidgetConfig[] | null) ?? null,
      widgetColors: (prefs?.widget_colors as Record<string, string> | null) ?? null,
    };
  }

  async updatePreferences(
    userId: number,
    data: {
      dashboardLayout?: WidgetConfig[];
      widgetColors?: Record<string, string>;
    }
  ): Promise<DashboardPreferences> {
    const existing = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.user_id, userId))
      .limit(1);

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (data.dashboardLayout !== undefined) {
      updateData.dashboard_layout = data.dashboardLayout;
    }
    if (data.widgetColors !== undefined) {
      updateData.widget_colors = data.widgetColors;
    }

    if (existing.length === 0) {
      const [created] = await db
        .insert(userPreferences)
        .values({
          user_id: userId,
          dashboard_layout: data.dashboardLayout ?? null,
          widget_colors: data.widgetColors ?? null,
        })
        .returning();

      return {
        dashboardLayout: (created.dashboard_layout as WidgetConfig[] | null) ?? null,
        widgetColors: (created.widget_colors as Record<string, string> | null) ?? null,
      };
    }

    const [updated] = await db
      .update(userPreferences)
      .set(updateData)
      .where(eq(userPreferences.user_id, userId))
      .returning();

    return {
      dashboardLayout: (updated.dashboard_layout as WidgetConfig[] | null) ?? null,
      widgetColors: (updated.widget_colors as Record<string, string> | null) ?? null,
    };
  }

  async resetToDefault(userId: number): Promise<void> {
    await db
      .update(userPreferences)
      .set({
        dashboard_layout: null,
        widget_colors: null,
        updated_at: new Date(),
      })
      .where(eq(userPreferences.user_id, userId));
  }
}

export const userPreferencesService = new UserPreferencesService();
