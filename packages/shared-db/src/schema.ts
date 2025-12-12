import {
  pgTable,
  varchar,
  text,
  timestamp,
  serial,
  integer,
  uuid,
  jsonb,
  boolean,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const teamRoleEnum = pgEnum("team_role", ["owner", "member", "manager"]);
export const teamTypeEnum = pgEnum("team_type", ["personal", "business", "enterprise"]);
// Tables

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  supabase_uid: uuid("supabase_uid").notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const usageStats = pgTable(
  "usage_stats",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(),
    clips_created: integer("clips_created").notNull().default(0),
    limit: integer("limit").notNull().default(3),
    resets_date: timestamp("resets_date").notNull(),
    rollover: boolean("rollover").notNull().default(false),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      teamDateIdx: index("usage_stats_team_id_date_idx").on(
        table.team_id,
        table.date
      ),
    };
  }
);

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: teamTypeEnum("type").notNull().default("personal"),
  teamSubscrptionId: varchar("team_subscription_id", { length: 255 }),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  team_id: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: teamRoleEnum("role").notNull().default("member"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  team_id: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  stripe_customer_id: varchar("stripe_customer_id", { length: 255 }).notNull(),
  stripe_subscription_id: varchar("stripe_subscription_id", {
    length: 255,
  }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  price_id: varchar("price_id", { length: 255 }).notNull(),
  current_period_start: timestamp("current_period_start").notNull(),
  current_period_end: timestamp("current_period_end").notNull(),
  cancel_at_period_end: boolean("cancel_at_period_end")
    .notNull()
    .default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});
