import { float } from "drizzle-orm/mysql-core";
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
  numeric,
  decimal,
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

export const gpuPodStatusEnum = pgEnum("gpu_pod_status", [
  "idle",
  "busy",
  "offline",
]);

export const comfyJobStatusEnum = pgEnum("comfy_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const characterJobStatusEnum = pgEnum("character_job_status", [
  "queued",
  "generating",
  "completed",
  "failed",
]);

export const ugcScriptStatusEnum = pgEnum("ugc_script_status", [
  "queued",
  "generating",
  "completed",
  "failed",
]);

// Tables

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  supabase_uid: uuid("supabase_uid").notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  is_affiliate: boolean("is_affiliate").notNull().default(false),
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
  enterprise_clip_limit: integer("enterprise_clip_limit"),
  enterprise_monthly_price: integer("enterprise_monthly_price"),
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
      parentIdx: index("clip_folders_parent_folder_id_idx").on(
        table.parent_folder_id
      ),
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

export const comfyJobs = pgTable(
  "comfy_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    status: comfyJobStatusEnum("status").notNull().default("queued"),
    imageFile: text("image_file").notNull(),
    videoFile: text("video_file").notNull(),
    workflowJson: jsonb("workflow_json"),
    assignedPod: text("assigned_pod"),
    progress: integer("progress").default(0),
    progressMessage: text("progress_message"),
    outputFile: text("output_file"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    parentJobId: uuid("parent_job_id"),
    priority: integer("priority").notNull().default(0),
    sequenceNumber: integer("sequence_number"),
    totalChunks: integer("total_chunks"),
    chunkStartTime: numeric("chunk_start_time", { precision: 10, scale: 3 }),
    chunkEndTime: numeric("chunk_end_time", { precision: 10, scale: 3 }),
    jobType: text("job_type").notNull().default("single"),
    originalVideoS3Key: text("original_video_s3_key"),
    spliceMode: boolean("splice_mode").default(false),
    spliceMetadata: jsonb("splice_metadata"),
  },
  (table) => {
    return {
      statusIdx: index("comfy_jobs_status_idx").on(table.status),
      teamIdx: index("comfy_jobs_team_id_idx").on(table.teamId),
      createdAtIdx: index("comfy_jobs_created_at_idx").on(table.createdAt),
      parentJobIdx: index("comfy_jobs_parent_job_id_idx").on(table.parentJobId),
      priorityCreatedAtIdx: index("comfy_jobs_priority_created_at_idx").on(
        table.priority,
        table.createdAt
      ),
    };
  }
).enableRLS();

export const referralCodes = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  created_by_team_id: integer("created_by_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "active",
  "churned",
]);

export const affiliateStatusEnum = pgEnum("affiliate_status", [
  "pending",
  "active",
  "churned",
]);

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referral_code_id: integer("referral_code_id")
    .notNull()
    .references(() => referralCodes.id, { onDelete: "cascade" }),
  referred_team_id: integer("referred_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  referred_plan: varchar("referred_plan", { length: 50 }),
  status: referralStatusEnum("status").notNull().default("pending"),
  percent_off: decimal("percent_off", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  bonus_clips: integer("bonus_clips").notNull().default(0),
  reward_applied: boolean("reward_applied").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();

export const characters = pgTable(
  "characters",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    public: boolean("public").notNull().default(false),

    gender: varchar("gender", { length: 20 }),
    age_range: varchar("age_range", { length: 20 }),
    vibe: varchar("vibe", { length: 50 }),

    appearance_config: jsonb("appearance_config"),
    style_config: jsonb("style_config"),

    character_images: jsonb("character_images").notNull(),
    primary_image_index: integer("primary_image_index").notNull().default(0),

    reference_images: jsonb("reference_images"),
    generation_prompt: text("generation_prompt"),

    parent_character_id: integer("parent_character_id"),
    is_variation: boolean("is_variation").notNull().default(false),

    uses_count: integer("uses_count").notNull().default(0),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("characters_team_id_idx").on(table.team_id),
    publicIdx: index("characters_public_idx").on(table.public),
    usesIdx: index("characters_uses_count_idx").on(table.uses_count),
    parentIdx: index("characters_parent_id_idx").on(table.parent_character_id),
  })
).enableRLS();

export const characterGenerationJobs = pgTable(
  "character_generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: characterJobStatusEnum("status").notNull().default("queued"),
    config: jsonb("config").notNull(),
    parent_character_id: integer("parent_character_id"),
    progress: integer("progress").notNull().default(0),
    progress_message: text("progress_message"),
    generated_images: jsonb("generated_images"),
    generation_prompt: text("generation_prompt"),
    error_message: text("error_message"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    started_at: timestamp("started_at"),
    completed_at: timestamp("completed_at"),
  },
  (table) => ({
    teamIdx: index("character_generation_jobs_team_id_idx").on(table.team_id),
    statusIdx: index("character_generation_jobs_status_idx").on(table.status),
    createdAtIdx: index("character_generation_jobs_created_at_idx").on(table.created_at),
  })
).enableRLS();

export const ugcScripts = pgTable(
  "ugc_scripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    character_id: integer("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    product_image_keys: jsonb("product_image_keys").notNull(),
    product_name: varchar("product_name", { length: 255 }),
    script_direction: text("script_direction"),
    scripts_data: jsonb("scripts_data"),
    selected_variant_index: integer("selected_variant_index").notNull().default(0),
    status: ugcScriptStatusEnum("status").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    progress_message: text("progress_message"),
    error_message: text("error_message"),
    structure_id: varchar("structure_id", { length: 50 }),
    custom_pattern: jsonb("custom_pattern"),
    target_duration: integer("target_duration").default(30),
    number_of_variations: integer("number_of_variations").default(2),
    started_at: timestamp("started_at"),
    completed_at: timestamp("completed_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("ugc_scripts_team_id_idx").on(table.team_id),
    characterIdx: index("ugc_scripts_character_id_idx").on(table.character_id),
    statusIdx: index("ugc_scripts_status_idx").on(table.status),
    createdAtIdx: index("ugc_scripts_created_at_idx").on(table.created_at),
  })
).enableRLS();

// Scene Image Generation - used for generating images for each scene in a script
export const sceneImageJobStatusEnum = pgEnum("scene_image_job_status", [
  "queued",
  "generating",
  "completed",
  "failed",
]);

export const sceneImageGenerationJobs = pgTable(
  "scene_image_generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    script_id: uuid("script_id").notNull(),
    scene_id: varchar("scene_id", { length: 255 }).notNull(),
    scene_number: integer("scene_number").notNull(),
    character_id: integer("character_id")
      .references(() => characters.id, { onDelete: "set null" }),
    prompt: text("prompt").notNull(),
    user_refinement: text("user_refinement"),
    supporting_image_keys: jsonb("supporting_image_keys").default([]),
    status: sceneImageJobStatusEnum("status").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    progress_message: text("progress_message"),
    generated_images: jsonb("generated_images"), // Array of S3 keys
    selected_image_index: integer("selected_image_index"),
    error_message: text("error_message"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    started_at: timestamp("started_at"),
    completed_at: timestamp("completed_at"),
  },
  (table) => ({
    teamIdx: index("scene_image_jobs_team_id_idx").on(table.team_id),
    scriptIdx: index("scene_image_jobs_script_id_idx").on(table.script_id),
    sceneIdx: index("scene_image_jobs_scene_id_idx").on(table.scene_id),
    statusIdx: index("scene_image_jobs_status_idx").on(table.status),
    createdAtIdx: index("scene_image_jobs_created_at_idx").on(table.created_at),
  })
).enableRLS();

// Final selected images for each scene
export const sceneImages = pgTable(
  "scene_images",
  {
    id: serial("id").primaryKey(),
    script_id: uuid("script_id").notNull(),
    scene_id: varchar("scene_id", { length: 255 }).notNull(),
    scene_number: integer("scene_number").notNull(),
    image_key: text("image_key").notNull(),
    generation_job_id: uuid("generation_job_id"),
    prompt_used: text("prompt_used"),
    user_refinement: text("user_refinement"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    scriptIdx: index("scene_images_script_id_idx").on(table.script_id),
    sceneIdx: index("scene_images_scene_id_idx").on(table.scene_id),
    scriptSceneIdx: index("scene_images_script_scene_idx").on(
      table.script_id,
      table.scene_id
    ),
  })
).enableRLS();
