import * as Sentry from "@sentry/node";
import jwt from "jsonwebtoken";
import { Redis } from "ioredis";
import { db } from "../db";
import {
  teams,
  subscriptions,
  usageStats,
  teamMembers,
  users,
} from "@clipper/shared-db/src/schema";
import { eq, count, and, sql } from "drizzle-orm";
import { stripe, ENTERPRISE_PRODUCT } from "../config/stripe.config";
import { emailNotiService } from "./emailNoti.service";
import adminConfig from "../config/admin.config.json";

const ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "admin-secret-key-change-in-production";
const TWO_FA_CODE_EXPIRY = 15 * 60;
const TWO_FA_CODE_PREFIX = "admin_2fa:";
const TWO_FA_RECIPIENT_EMAIL = "contact@cuttr.com";
let redisClient: Redis | null = null;
const inMemory2FACodes = new Map<string, { code: string; expiresAt: number }>();

const initRedis = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && !redisClient) {
    try {
      redisClient = new Redis(redisUrl);
      await redisClient.ping();
      console.log("Admin 2FA: Using Redis for code storage");
    } catch (error) {
      console.log("Admin 2FA: Redis unavailable, using in-memory storage");
      Sentry.captureException(error);
      redisClient = null;
    }
  }
};

// Initialize Redis on module load
initRedis();

class AdminService {
  validateCredentials(email: string, password: string): boolean {
    return (
      email === adminConfig.credentials.email &&
      password === adminConfig.credentials.password
    );
  }

  generateToken(email: string): string {
    return jwt.sign({ email, isAdmin: true }, ADMIN_JWT_SECRET, {
      expiresIn: "7d",
    });
  }

  verifyToken(token: string): { email: string; isAdmin: boolean } | null {
    try {
      return jwt.verify(token, ADMIN_JWT_SECRET) as {
        email: string;
        isAdmin: boolean;
      };
    } catch {
      return null;
    }
  }

  // Generate a 6-digit code
  private generate2FACode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store 2FA code
  async store2FACode(email: string, code: string): Promise<void> {
    const key = TWO_FA_CODE_PREFIX + email;

    if (redisClient) {
      await redisClient.setex(key, TWO_FA_CODE_EXPIRY, code);
    } else {
      inMemory2FACodes.set(key, {
        code,
        expiresAt: Date.now() + TWO_FA_CODE_EXPIRY * 1000,
      });
    }
  }

  // Verify and consume 2FA code
  async verify2FACode(email: string, code: string): Promise<boolean> {
    const key = TWO_FA_CODE_PREFIX + email;

    if (redisClient) {
      const storedCode = await redisClient.get(key);
      if (storedCode === code) {
        await redisClient.del(key);
        return true;
      }
      return false;
    } else {
      const stored = inMemory2FACodes.get(key);
      if (stored && stored.code === code && stored.expiresAt > Date.now()) {
        inMemory2FACodes.delete(key);
        return true;
      }
      return false;
    }
  }

  // Send 2FA code via email (always sent to contact@cuttr.com)
  async send2FACode(email: string): Promise<void> {
    const code = this.generate2FACode();
    await this.store2FACode(email, code);
    await emailNotiService.sendAdmin2FACode(TWO_FA_RECIPIENT_EMAIL, { code });
  }

  async getAllTeams(options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const { search, limit = 50, offset = 0 } = options || {};

    let query = db
      .select({
        id: teams.id,
        name: teams.name,
        type: teams.type,
        plan: teams.plan,
        stripeCustomerId: teams.stripe_customer_id,
        enterpriseClipLimit: teams.enterprise_clip_limit,
        enterpriseMonthlyPrice: teams.enterprise_monthly_price,
        createdAt: teams.created_at,
      })
      .from(teams)
      .orderBy(teams.created_at)
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ total }] = await db.select({ total: count() }).from(teams);

    const allTeams = await query;

    const teamsWithDetails = await Promise.all(
      allTeams.map(async (team) => {
        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.team_id, team.id))
          .limit(1);

        const [usage] = await db
          .select({
            clips_created: usageStats.clips_created,
            limit: usageStats.limit,
          })
          .from(usageStats)
          .where(eq(usageStats.team_id, team.id))
          .limit(1);

        // Get member count
        const [memberCountResult] = await db
          .select({ count: count() })
          .from(teamMembers)
          .where(eq(teamMembers.team_id, team.id));

        // Get owner email
        const ownerResult = await db
          .select({
            email: users.email,
          })
          .from(teamMembers)
          .innerJoin(users, eq(teamMembers.user_id, users.id))
          .where(
            and(eq(teamMembers.team_id, team.id), eq(teamMembers.role, "owner"))
          )
          .limit(1);

        return {
          ...team,
          subscription: sub || null,
          usage: usage || null,
          memberCount: memberCountResult?.count || 0,
          ownerEmail: ownerResult[0]?.email || null,
        };
      })
    );

    // Filter by search if provided (done after fetching for simplicity)
    let filteredTeams = teamsWithDetails;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTeams = teamsWithDetails.filter(
        (team) =>
          team.name.toLowerCase().includes(searchLower) ||
          team.ownerEmail?.toLowerCase().includes(searchLower) ||
          team.plan.toLowerCase().includes(searchLower)
      );
    }

    return {
      teams: filteredTeams,
      pagination: {
        total: Number(total),
        limit,
        offset,
        hasMore: offset + limit < Number(total),
      },
    };
  }

  async createEnterprisePrice(
    monthlyAmountCents: number,
    teamId: number,
    teamName: string
  ): Promise<string> {
    const price = await stripe.prices.create({
      unit_amount: monthlyAmountCents,
      currency: "usd",
      recurring: { interval: "month" },
      product: ENTERPRISE_PRODUCT,
      nickname: `Enterprise - ${teamName}`,
      metadata: {
        teamId: teamId.toString(),
        teamName,
        plan: "enterprise",
      },
    });
    return price.id;
  }

  async setupEnterprise(
    teamId: number,
    clipLimit: number,
    monthlyPriceCents: number,
    customerEmail: string,
    previousSubscriptionId?: string
  ): Promise<{ checkoutUrl: string; priceId: string }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) throw new Error("Team not found");

    const priceId = await this.createEnterprisePrice(
      monthlyPriceCents,
      teamId,
      team.name
    );

    await db
      .update(teams)
      .set({
        enterprise_clip_limit: clipLimit,
        enterprise_monthly_price: monthlyPriceCents,
        updated_at: new Date(),
      })
      .where(eq(teams.id, teamId));

    let customerId = team.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: customerEmail });
      customerId = customer.id;
      await db
        .update(teams)
        .set({ stripe_customer_id: customerId, updated_at: new Date() })
        .where(eq(teams.id, teamId));
    }

    const metadata: Record<string, string> = {
      teamId: teamId.toString(),
      plan: "enterprise",
    };
    if (previousSubscriptionId) {
      metadata.cancel_previous_subscription = previousSubscriptionId;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card", "us_bank_account"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL || "https://platform.cuttr.com"}/dashboard?enterprise=success`,
      cancel_url: `${process.env.FRONTEND_URL || "https://platform.cuttr.com"}/dashboard?enterprise=canceled`,
      allow_promotion_codes: true,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    return { checkoutUrl: session.url!, priceId };
  }

  async getTeamById(teamId: number) {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    return team;
  }

  async changePlanToEnterprise(
    teamId: number,
    clipLimit: number,
    monthlyPriceCents: number,
    customerEmail: string
  ): Promise<{
    checkoutUrl: string;
    priceId: string;
    hasPreviousSubscription: boolean;
  }> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (!team) throw new Error("Team not found");

    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.team_id, teamId))
      .limit(1);

    const previousSubscriptionId =
      existingSub?.stripe_subscription_id && existingSub.status === "active"
        ? existingSub.stripe_subscription_id
        : undefined;

    const result = await this.setupEnterprise(
      teamId,
      clipLimit,
      monthlyPriceCents,
      customerEmail,
      previousSubscriptionId
    );

    return {
      ...result,
      hasPreviousSubscription: !!previousSubscriptionId,
    };
  }
}

export const adminService = new AdminService();
