import * as Sentry from "@sentry/node";
import crypto from "crypto";
import { promisify } from "util";
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
import { eq, count, and, sql, desc, inArray } from "drizzle-orm";
import { stripe, ENTERPRISE_PRODUCT } from "../config/stripe.config";
import { emailNotiService } from "./emailNoti.service";

const scryptAsync = promisify(crypto.scrypt);

function getAdminJwtSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET environment variable is required");
  }
  return secret;
}

function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || "admin@cuttr.com";
}

function getAdminPasswordHash(): string {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    throw new Error("ADMIN_PASSWORD_HASH environment variable is required");
  }
  return hash;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derivedKey);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(32).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

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

initRedis();

class AdminService {
  async validateCredentials(email: string, password: string): Promise<boolean> {
    if (email !== getAdminEmail()) return false;
    try {
      return await verifyPassword(password, getAdminPasswordHash());
    } catch {
      return false;
    }
  }

  generateToken(email: string): string {
    return jwt.sign({ email, isAdmin: true }, getAdminJwtSecret(), {
      expiresIn: "4h",
    });
  }

  verifyToken(token: string): { email: string; isAdmin: boolean } | null {
    try {
      return jwt.verify(token, getAdminJwtSecret()) as {
        email: string;
        isAdmin: boolean;
      };
    } catch {
      return null;
    }
  }

  private generate2FACode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

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

    // Search filter applied at SQL level BEFORE pagination
    const whereCondition = search
      ? sql`(
          ${teams.name} ILIKE ${"%" + search + "%"}
          OR ${teams.plan} ILIKE ${"%" + search + "%"}
          OR EXISTS (
            SELECT 1 FROM team_members tm
            INNER JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ${teams.id}
            AND tm.role = 'owner'
            AND u.email ILIKE ${"%" + search + "%"}
          )
        )`
      : sql`TRUE`;

    const allTeams = await db
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
      .where(whereCondition)
      .orderBy(teams.created_at)
      .limit(limit)
      .offset(offset);

    // Get total count with same search filter for accurate pagination
    const [{ total }] = await db
      .select({ total: count() })
      .from(teams)
      .where(whereCondition);

    const teamIds = allTeams.map((t) => t.id);

    if (teamIds.length === 0) {
      return {
        teams: [],
        pagination: { total: Number(total), limit, offset, hasMore: false },
      };
    }

    const subsRows = await db.select().from(subscriptions).where(inArray(subscriptions.team_id, teamIds));
    const subsMap = new Map(subsRows.map((r) => [r.team_id, r]));

    const usageRows = await db
      .select({ team_id: usageStats.team_id, clips_created: usageStats.clips_created, limit: usageStats.limit })
      .from(usageStats)
      .where(inArray(usageStats.team_id, teamIds));
    const usageMap = new Map<number, { clips_created: number; limit: number }>();
    for (const r of usageRows) {
      if (!usageMap.has(r.team_id)) usageMap.set(r.team_id, r);
    }

    const memberRows = await db
      .select({ team_id: teamMembers.team_id, count: count() })
      .from(teamMembers)
      .where(inArray(teamMembers.team_id, teamIds))
      .groupBy(teamMembers.team_id);
    const memberCountMap = new Map(memberRows.map((r) => [r.team_id, Number(r.count)]));

    const ownerRows = await db
      .select({ team_id: teamMembers.team_id, email: users.email })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.user_id, users.id))
      .where(and(inArray(teamMembers.team_id, teamIds), eq(teamMembers.role, "owner")));
    const ownerMap = new Map(ownerRows.map((r) => [r.team_id, r.email]));

    const teamsWithDetails = allTeams.map((team) => ({
      ...team,
      subscription: subsMap.get(team.id) || null,
      usage: usageMap.get(team.id) || null,
      memberCount: memberCountMap.get(team.id) || 0,
      ownerEmail: ownerMap.get(team.id) || null,
    }));

    return {
      teams: teamsWithDetails,
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
