import { float } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
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
  real,
  unique,
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
  "pending_upload",
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
    limit: integer("limit").notNull().default(15),
    resets_date: timestamp("resets_date").notNull(),
    rollover: boolean("rollover").notNull().default(false),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      teamDateIdx: index("usage_stats_team_id_date_idx").on(
        table.team_id,
        table.date,
      ),
    };
  },
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
  logo_url: text("logo_url"),
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
  },
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
      },
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
        table.generated_by_user_id,
      ),
      folderIdx: index("clips_folder_id_idx").on(table.folder_id),
      shareTokenIdx: index("clips_share_token_idx").on(table.share_token),
      // GIN trigram indexes for fuzzy search (requires pg_trgm extension)
      titleTrgmIdx: index("clips_title_trgm_idx").using(
        "gin",
        sql`${table.title} gin_trgm_ops`,
      ),
      messageTrgmIdx: index("clips_message_trgm_idx").using(
        "gin",
        sql`${table.message} gin_trgm_ops`,
      ),
    };
  },
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
        table.parent_folder_id,
      ),
    };
  },
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
  },
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
  },
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
        table.tag_id,
      ),
    };
  },
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
        table.createdAt,
      ),
    };
  },
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

export const announcementPriorityEnum = pgEnum("announcement_priority", [
  "info",
  "warning",
  "critical",
]);

export const announcementStatusEnum = pgEnum("announcement_status", [
  "draft",
  "published",
  "archived",
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
  }),
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
    createdAtIdx: index("character_generation_jobs_created_at_idx").on(
      table.created_at,
    ),
  }),
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
    selected_variant_index: integer("selected_variant_index")
      .notNull()
      .default(0),
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
  }),
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
    character_id: integer("character_id").references(() => characters.id, {
      onDelete: "set null",
    }),
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
  }),
).enableRLS();

export const sceneImages = pgTable(
  "scene_images",
  {
    id: serial("id").primaryKey(),
    script_id: uuid("script_id").notNull(),
    scene_id: varchar("scene_id", { length: 255 }).notNull(),
    scene_number: integer("scene_number").notNull(),
    image_key: text("image_key").notNull(),
    end_image_key: text("end_image_key"),
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
      table.scene_id,
    ),
  }),
).enableRLS();

// UGC Video Generation - orchestrates TTS, image-to-video, and lipsync for each scene
export const ugcVideoJobStatusEnum = pgEnum("ugc_video_job_status", [
  "queued",
  "generating",
  "completed",
  "failed",
]);

export const adCloneProjectStatusEnum = pgEnum("ad_clone_project_status", [
  "uploading",
  "analyzing",
  "analysis_complete",
  "generating_script",
  "script_generated",
  "generating_video",
  "completed",
  "failed",
]);

export const ugcVideoGenerationJobs = pgTable(
  "ugc_video_generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    script_id: uuid("script_id").notNull(),
    voice_id: varchar("voice_id", { length: 255 }).notNull(),
    status: ugcVideoJobStatusEnum("status").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    progress_message: text("progress_message"),
    // Tracks each scene's video/audio keys as they're processed
    scene_videos: jsonb("scene_videos"), // Array of { sceneId, sceneNumber, audioKey, videoKey }
    final_video_key: text("final_video_key"),
    total_duration_seconds: real("total_duration_seconds"),
    error_message: text("error_message"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    started_at: timestamp("started_at"),
    completed_at: timestamp("completed_at"),
  },
  (table) => ({
    teamIdx: index("ugc_video_jobs_team_id_idx").on(table.team_id),
    scriptIdx: index("ugc_video_jobs_script_id_idx").on(table.script_id),
    statusIdx: index("ugc_video_jobs_status_idx").on(table.status),
    createdAtIdx: index("ugc_video_jobs_created_at_idx").on(table.created_at),
  }),
).enableRLS();

export const adCloneProjects = pgTable(
  "ad_clone_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reference_video_key: text("reference_video_key"),
    product_image_keys: jsonb("product_image_keys").notNull(),
    product_name: varchar("product_name", { length: 255 }),
    product_description: text("product_description"),
    ad_direction: text("ad_direction"),
    gemini_file_name: text("gemini_file_name"),
    gemini_file_uri: text("gemini_file_uri"),
    video_analysis: jsonb("video_analysis"),
    adapted_scripts: jsonb("adapted_scripts"),
    selected_variant_index: integer("selected_variant_index")
      .notNull()
      .default(0),
    character_id: integer("character_id").references(() => characters.id, {
      onDelete: "set null",
    }),
    voice_id: varchar("voice_id", { length: 255 }),
    status: adCloneProjectStatusEnum("status").notNull().default("uploading"),
    progress: integer("progress").notNull().default(0),
    progress_message: text("progress_message"),
    error_message: text("error_message"),
    final_video_key: text("final_video_key"),
    video_job_id: uuid("video_job_id"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("ad_clone_projects_team_id_idx").on(table.team_id),
    userIdx: index("ad_clone_projects_user_id_idx").on(table.user_id),
    statusIdx: index("ad_clone_projects_status_idx").on(table.status),
    createdAtIdx: index("ad_clone_projects_created_at_idx").on(
      table.created_at,
    ),
  }),
).enableRLS();

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    dashboard_layout: jsonb("dashboard_layout"),
    widget_colors: jsonb("widget_colors"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("user_preferences_user_id_idx").on(table.user_id),
  }),
).enableRLS();

export const savedFaces = pgTable(
  "saved_faces",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    image_key: text("image_key").notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("saved_faces_team_id_idx").on(table.team_id),
  }),
).enableRLS();

export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    priority: announcementPriorityEnum("priority").notNull().default("info"),
    status: announcementStatusEnum("status").notNull().default("draft"),
    icon: varchar("icon", { length: 100 }),
    action_label: varchar("action_label", { length: 50 }),
    action_url: text("action_url"),
    created_by_admin_email: varchar("created_by_admin_email", {
      length: 255,
    }).notNull(),
    published_at: timestamp("published_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("announcements_status_idx").on(table.status),
    publishedAtIdx: index("announcements_published_at_idx").on(
      table.published_at,
    ),
  }),
).enableRLS();

export const userAnnouncementDismissals = pgTable(
  "user_announcement_dismissals",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    announcement_id: integer("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    dismissed_at: timestamp("dismissed_at").notNull().defaultNow(),
  },
  (table) => ({
    userAnnouncementUnique: unique("user_announcement_unique").on(
      table.user_id,
      table.announcement_id,
    ),
    userIdIdx: index("user_announcement_dismissals_user_id_idx").on(
      table.user_id,
    ),
    announcementIdIdx: index(
      "user_announcement_dismissals_announcement_id_idx",
    ).on(table.announcement_id),
  }),
).enableRLS();

export const massPostingStatusEnum = pgEnum("mass_posting_status", [
  "pending",
  "accepted",
  "rejected",
  "appeal",
]);
export const massPostingApplications = pgTable(
  "mass_posting_applications",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    intake_form_id: integer("intake_form_id").references(() => intakeForms.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    details: jsonb("details"),
    google_drive_folder_id: varchar("google_drive_folder_id", { length: 255 }),
    rejection_reason: text("rejection_reason"),
    admin_notes: text("admin_notes"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("mass_posting_applications_team_id_idx").on(table.team_id),
  }),
).enableRLS();
export const intakeForms = pgTable(
  "intake_forms",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .unique()
      .references(() => teams.id, { onDelete: "cascade" }),
    brand_description: text("brand_description"),
    company_website_url: varchar("company_website_url", { length: 2048 }),
    icps: jsonb("icps"),
    company_socials: jsonb("company_socials"),
    competitor_socials: jsonb("competitor_socials"),
    completed: boolean("completed").notNull().default(false),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("intake_forms_team_id_idx").on(table.team_id),
  }),
).enableRLS();

export const platformEnum = pgEnum("platform_enum", [
  "tiktok",
  "instagram",
  "facebook",
  "youtube",
  "x",
]);

export const postStatusEnum = pgEnum("post_status_enum", [
  "processing",
  "scheduled",
  "posted",
  "cancelled",
  "deleted",
  "failed",
]);
export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    clip_id: integer("clip_id").references(() => clips.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    platform: platformEnum("platform").notNull(),
    posted_time: timestamp("posted_time").notNull().defaultNow(),
    post_url: text("post_url"),
    drive_file_id: varchar("drive_file_id", { length: 255 }),
    status: postStatusEnum("status").notNull().default("scheduled"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("posts_team_id_idx").on(table.team_id),
    platformIdx: index("posts_platform_idx").on(table.platform),
    clipIdx: index("posts_clip_id_idx").on(table.clip_id),
  }),
).enableRLS();

// Virality Tracking
export const viralityPlatformEnum = pgEnum("virality_platform", [
  "instagram",
  "tiktok",
  "x",
]);
export const viralitySyncStatusEnum = pgEnum("virality_sync_status", [
  "pending",
  "syncing",
  "completed",
  "failed",
]);

// Competitor groups (e.g., "Nike", "Competitor A")
export const viralityCompetitors = pgTable(
  "virality_competitors",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("virality_competitors_team_id_idx").on(table.team_id),
  }),
).enableRLS();

// Platform accounts (instagram, tiktok, x) - up to 3 per competitor
export const viralityAccounts = pgTable(
  "virality_accounts",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    competitor_id: integer("competitor_id").references(
      () => viralityCompetitors.id,
      { onDelete: "cascade" },
    ),
    platform: viralityPlatformEnum("platform").notNull(),
    username: varchar("username", { length: 255 }).notNull(),
    profile_url: text("profile_url").notNull(),
    display_name: varchar("display_name", { length: 255 }),
    avatar_url: text("avatar_url"),
    bio: text("bio"),
    follower_count: integer("follower_count"),
    following_count: integer("following_count"),
    total_likes: integer("total_likes"),
    post_count: integer("post_count"),
    follower_history: jsonb("follower_history"),
    is_verified: boolean("is_verified").default(false),
    last_synced_at: timestamp("last_synced_at"),
    sync_status: viralitySyncStatusEnum("sync_status").default("pending"),
    sync_error: text("sync_error"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("virality_accounts_team_id_idx").on(table.team_id),
    uniqueTeamPlatformUsername: unique("virality_accounts_unique").on(
      table.team_id,
      table.platform,
      table.username,
    ),
  }),
).enableRLS();


export const viralityPosts = pgTable(
  "virality_posts",
  {
    id: serial("id").primaryKey(),
    account_id: integer("account_id")
      .notNull()
      .references(() => viralityAccounts.id, { onDelete: "cascade" }),
    platform_post_id: varchar("platform_post_id", { length: 255 }).notNull(),
    post_url: text("post_url").notNull(),
    thumbnail_url: text("thumbnail_url"),
    caption: text("caption"),
    hashtags: jsonb("hashtags"),
    post_type: varchar("post_type", { length: 50 }),
    posted_at: timestamp("posted_at"),
    like_count: integer("like_count").default(0),
    comment_count: integer("comment_count").default(0),
    video_view_count: integer("video_view_count"),
    video_play_count: integer("video_play_count"),
    metrics_history: jsonb("metrics_history").default([]),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index("virality_posts_account_id_idx").on(table.account_id),
    uniqueAccountPost: unique("virality_posts_unique").on(
      table.account_id,
      table.platform_post_id,
    ),
    postedAtIdx: index("virality_posts_posted_at_idx").on(table.posted_at),
  }),
).enableRLS();

export const genderEnum = pgEnum("gender_enum", ["male", "female", "other"]);
export const clonedVoices = pgTable("cloned_voices", {
  id: serial("id").primaryKey(),
  team_id: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  voice_id: varchar("voice_id", { length: 255 }).notNull(),
  sample_audio_key: text("sample_audio_key").notNull(),
  gender: genderEnum("gender").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();

export const APIKeys = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    key_prefix: varchar("key_prefix", { length: 12 }).notNull(),
    key_hash: varchar("key_hash", { length: 255 }).notNull().unique(),
    last_used_at: timestamp("last_used_at"),
    expires_at: timestamp("expires_at"),
    revoked: boolean("revoked").notNull().default(false),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("api_keys_team_id_idx").on(table.team_id),
    keyHashIdx: index("api_keys_key_hash_idx").on(table.key_hash),
  }),
).enableRLS();

export const apiBillingAccounts = pgTable(
  "api_billing_accounts",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .unique()
      .references(() => teams.id, { onDelete: "cascade" }),
    balance_cents: integer("balance_cents").notNull().default(0),
    total_spent_cents: integer("total_spent_cents").notNull().default(0),
    total_topped_up_cents: integer("total_topped_up_cents").notNull().default(0),
    active: boolean("active").notNull().default(false),
    auto_refill: boolean("auto_refill").notNull().default(false),
    refill_threshold_cents: integer("refill_threshold_cents").notNull().default(500),
    refill_amount_cents: integer("refill_amount_cents").notNull().default(2500),
    stripe_payment_method_id: varchar("stripe_payment_method_id", { length: 255 }),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("api_billing_accounts_team_id_idx").on(table.team_id),
  }),
).enableRLS();

export const apiWalletTopUps = pgTable(
  "api_wallet_top_ups",
  {
    id: serial("id").primaryKey(),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    amount_cents: integer("amount_cents").notNull(),
    credits_cents: integer("credits_cents").notNull(),
    stripe_payment_intent_id: varchar("stripe_payment_intent_id", { length: 255 }),
    stripe_checkout_session_id: varchar("stripe_checkout_session_id", { length: 255 }),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("api_wallet_top_ups_team_id_idx").on(table.team_id),
  }),
).enableRLS();

export const apiUsageLogs = pgTable(
  "api_usage_logs",
  {
    id: serial("id").primaryKey(),
    api_key_id: integer("api_key_id")
      .notNull()
      .references(() => APIKeys.id, { onDelete: "cascade" }),
    team_id: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    product_slug: varchar("product_slug", { length: 100 }),
    endpoint: varchar("endpoint", { length: 255 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    status_code: integer("status_code").notNull(),
    cost_cents: integer("cost_cents").notNull().default(0),
    quantity: integer("quantity").notNull().default(1),
    response_time_ms: integer("response_time_ms"),
    metadata: jsonb("metadata"),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    apiKeyIdx: index("api_usage_logs_api_key_id_idx").on(table.api_key_id),
    teamIdx: index("api_usage_logs_team_id_idx").on(table.team_id),
    createdAtIdx: index("api_usage_logs_created_at_idx").on(table.created_at),
    productSlugIdx: index("api_usage_logs_product_slug_idx").on(
      table.product_slug,
    ),
  }),
).enableRLS();
