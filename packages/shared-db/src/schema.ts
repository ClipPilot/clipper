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
export const teamTypeEnum = pgEnum("team_type", [
  "personal",
  "business",
  "enterprise",
]);

export const clipStatusEnum = pgEnum("clip_status", [
  "pending",
  "completed",
  "failed",
  "rejected",
  "expired",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);
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
}).enableRLS();

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
).enableRLS();

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: teamTypeEnum("type").notNull().default("personal"),
  teamSubscrptionId: varchar("team_subscription_id", { length: 255 }),
  stripe_customer_id: varchar("stripe_customer_id", { length: 255 }),
  plan: varchar("plan", { length: 50 }).notNull().default("free"),
  addon_clips_remaining: integer("addon_clips_remaining").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();

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
}).enableRLS();

export const teamInvites = pgTable(
  "team_invites",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    invited_by_user_id: integer("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: teamRoleEnum("role").notNull().default("member"),
    token: varchar("token", { length: 255 }).notNull().unique(),
    status: inviteStatusEnum("status").notNull().default("pending"),
    expires_at: timestamp("expires_at").notNull(),
    accepted_at: timestamp("accepted_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      emailIdx: index("team_invites_email_idx").on(table.email),
      tokenIdx: index("team_invites_token_idx").on(table.token),
      teamIdx: index("team_invites_team_id_idx").on(table.team_id),
    };
  }
).enableRLS();

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
  plan: varchar("plan", { length: 50 }).notNull(),
  price_id: varchar("price_id", { length: 255 }).notNull(),
  current_period_start: timestamp("current_period_start").notNull(),
  current_period_end: timestamp("current_period_end").notNull(),
  cancel_at_period_end: boolean("cancel_at_period_end")
    .notNull()
    .default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();

export const clips = pgTable(
  "clips",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    generated_by_user_id: integer("generated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    folder_id: integer("folder_id").references(() => clipFolders.id, {
      onDelete: "set null",
    }),
    clip_path: text("clip_path"),
    blank_video_path: text("blank_video_path"),
    watermarked_clip_path: text("watermarked_clip_path"),
    srt_path: text("srt_path"),
    captions_data: jsonb("captions_data"),
    clip_score: integer("clip_score"),
    source_video_path: text("source_video_path"),
    clip_metadata: jsonb("clip_metadata"),
    input_metadata: jsonb("input_metadata"),
    prompt: text("prompt"),
    raw_video_id: integer("raw_video_id").references(
      () => uploadedRawVideos.id,
      {
        onDelete: "set null",
      }
    ),
    title: varchar("title", { length: 255 }),
    message: text("message"),
    status: clipStatusEnum("status").notNull().default("pending"),
    saved: boolean("saved").notNull().default(false),
    share_token: varchar("share_token", { length: 64 }).unique(),
    error_message: text("error_message"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      teamIdx: index("clips_team_id_idx").on(table.team_id),
      userIdx: index("clips_generated_by_user_id_idx").on(
        table.generated_by_user_id
      ),
      folderIdx: index("clips_folder_id_idx").on(table.folder_id),
      shareTokenIdx: index("clips_share_token_idx").on(table.share_token),
    };
  }
).enableRLS();

export const clipFolders = pgTable(
  "clip_folders",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    parent_folder_id: integer("parent_folder_id"),
    name: varchar("name", { length: 255 }).notNull(),
    color: varchar("color", { length: 50 }),
    message: text("message"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      teamIdx: index("clip_folders_team_id_idx").on(table.team_id),
      parentIdx: index("clip_folders_parent_folder_id_idx").on(table.parent_folder_id),
    };
  }
).enableRLS();

export const uploadedRawVideos = pgTable(
  "uploaded_raw_videos",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    video_path: text("video_path").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      teamIdx: index("uploaded_raw_videos_team_id_idx").on(table.team_id),
    };
  }
).enableRLS();

export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 50 }).notNull().default("#6366f1"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      teamIdx: index("tags_team_id_idx").on(table.team_id),
      teamNameIdx: index("tags_team_id_name_idx").on(table.team_id, table.name),
    };
  }
).enableRLS();

export const clipTags = pgTable(
  "clip_tags",
  {
    id: serial("id").primaryKey(),
    clip_id: integer("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    tag_id: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      clipIdx: index("clip_tags_clip_id_idx").on(table.clip_id),
      tagIdx: index("clip_tags_tag_id_idx").on(table.tag_id),
      uniqueClipTag: index("clip_tags_clip_id_tag_id_idx").on(
        table.clip_id,
        table.tag_id
      ),
    };
  }
).enableRLS();
