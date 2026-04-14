import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AI Video Clipper API",
      version: "1.0.0",
      description:
        "API for automatically generating short-form video clips from long-form content using AI",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token from authentication",
        },
        adminAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Admin JWT token from /api/admin/login",
        },
        internalApiKey: {
          type: "apiKey",
          in: "header",
          name: "x-internal-api-key",
          description: "Internal API key for worker-to-server communication",
        },
      },
      schemas: {
        User: {
          type: "object",
          required: ["id", "email"],
          properties: {
            id: {
              type: "string",
            },
            email: {
              type: "string",
              format: "email",
            },
            firstName: {
              type: "string",
            },
            lastName: {
              type: "string",
            },
            emailNotificationsEnabled: {
              type: "boolean",
            },
          },
        },
        Session: {
          type: "object",
          properties: {
            access_token: {
              type: "string",
              description: "JWT access token",
            },
            refresh_token: {
              type: "string",
              description: "JWT refresh token",
            },
            expires_at: {
              type: "number",
              description: "Token expiration timestamp",
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Response message",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
            session: {
              $ref: "#/components/schemas/Session",
            },
          },
        },
        ClipSegment: {
          type: "object",
          required: ["text", "start", "end"],
          properties: {
            text: {
              type: "string",
              description: "The transcript text for this clip segment",
            },
            start: {
              type: "number",
              description: "Start time in seconds",
            },
            end: {
              type: "number",
              description: "End time in seconds",
            },
          },
        },
        ClipSuggestions: {
          type: "object",
          required: ["hook", "main", "combined_script"],
          properties: {
            hook: {
              $ref: "#/components/schemas/ClipSegment",
              description: "The engaging hook clip (6 seconds max)",
            },
            main: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ClipSegment",
              },
              description: "Array of main content clips that tell the story",
            },
            combined_script: {
              type: "string",
              description: "The complete script combining hook and main clips",
            },
          },
        },
        ClipResponse: {
          type: "object",
          required: ["clipPath"],
          properties: {
            clipPath: {
              type: "string",
              description: "File path to the generated combined video clip",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "string",
            },
            message: {
              type: "string",
            },
          },
        },
        AnalyticsPriceEntry: {
          type: "object",
          required: ["amount", "currency", "interval"],
          properties: {
            amount: {
              type: "integer",
              description: "Price in cents",
            },
            currency: {
              type: "string",
              description: "Three-letter ISO currency code",
            },
            interval: {
              type: "string",
              nullable: true,
              description: "Billing interval (month, year) or null for one-time",
            },
          },
        },
        AnalyticsPricesResponse: {
          type: "object",
          required: ["prices"],
          properties: {
            prices: {
              type: "object",
              additionalProperties: {
                $ref: "#/components/schemas/AnalyticsPriceEntry",
              },
            },
          },
        },
        Subscription: {
          type: "object",
          required: [
            "id",
            "team_id",
            "stripe_customer_id",
            "stripe_subscription_id",
            "status",
            "plan",
            "price_id",
            "current_period_start",
            "current_period_end",
            "cancel_at_period_end",
          ],
          properties: {
            id: {
              type: "integer",
              description: "Subscription ID",
            },
            team_id: {
              type: "integer",
              description: "Associated team ID",
            },
            stripe_customer_id: {
              type: "string",
              description: "Stripe customer ID",
            },
            stripe_subscription_id: {
              type: "string",
              description: "Stripe subscription ID",
            },
            status: {
              type: "string",
              enum: ["active", "canceled", "past_due", "trialing", "unpaid"],
              description: "Subscription status",
            },
            plan: {
              type: "string",
              enum: ["free", "creator", "studio", "scale", "enterprise"],
              description: "Current plan name",
            },
            price_id: {
              type: "string",
              description: "Stripe price ID",
            },
            current_period_start: {
              type: "string",
              format: "date-time",
              description: "Current billing period start",
            },
            current_period_end: {
              type: "string",
              format: "date-time",
              description: "Current billing period end",
            },
            cancel_at_period_end: {
              type: "boolean",
              description: "Whether subscription will cancel at period end",
            },
          },
        },
        UsageInfo: {
          type: "object",
          properties: {
            clipsCreated: {
              type: "integer",
              description: "Number of credits used this period",
            },
            limit: {
              type: "integer",
              description: "Maximum credits allowed per period",
            },
            remaining: {
              type: "integer",
              description: "Remaining credits this period",
            },
            resetsDate: {
              type: "string",
              format: "date-time",
              description: "When the usage resets",
            },
            plan: {
              type: "string",
              enum: ["free", "creator", "studio", "scale", "enterprise"],
              description: "Current plan name",
            },
          },
        },
        Team: {
          type: "object",
          required: ["id", "name", "type", "plan", "role", "created_at", "updated_at"],
          properties: {
            id: {
              type: "integer",
            },
            name: {
              type: "string",
            },
            type: {
              type: "string",
              enum: ["personal", "business", "enterprise"],
            },
            plan: {
              type: "string",
              enum: ["free", "creator", "studio", "scale", "enterprise"],
            },
            role: {
              type: "string",
              enum: ["owner", "manager", "member"],
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
            updated_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Folder: {
          type: "object",
          required: ["id", "team_id", "name", "created_at", "updated_at"],
          properties: {
            id: {
              type: "integer",
            },
            team_id: {
              type: "integer",
            },
            parent_folder_id: {
              type: "integer",
              nullable: true,
            },
            name: {
              type: "string",
            },
            color: {
              type: "string",
            },
            message: {
              type: "string",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
            updated_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Tag: {
          type: "object",
          required: ["id", "team_id", "name", "color", "created_at", "updated_at"],
          properties: {
            id: {
              type: "integer",
            },
            team_id: {
              type: "integer",
            },
            name: {
              type: "string",
            },
            color: {
              type: "string",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
            updated_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        CaptionEntry: {
          type: "object",
          required: ["index", "startTime", "endTime", "text"],
          properties: {
            index: {
              type: "integer",
            },
            startTime: {
              type: "number",
            },
            endTime: {
              type: "number",
            },
            text: {
              type: "string",
            },
          },
        },
        TeamMember: {
          type: "object",
          required: ["id", "userId", "email", "firstName", "lastName", "role", "joinedAt"],
          properties: {
            id: {
              type: "integer",
            },
            userId: {
              type: "integer",
            },
            email: {
              type: "string",
              format: "email",
            },
            firstName: {
              type: "string",
            },
            lastName: {
              type: "string",
            },
            role: {
              type: "string",
              enum: ["owner", "manager", "member"],
            },
            joinedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        TeamInvite: {
          type: "object",
          required: ["id", "email", "role", "status", "expiresAt", "createdAt", "invitedBy"],
          properties: {
            id: {
              type: "integer",
            },
            email: {
              type: "string",
              format: "email",
            },
            role: {
              type: "string",
              enum: ["owner", "manager", "member"],
            },
            status: {
              type: "string",
              enum: ["pending", "accepted", "revoked", "expired"],
            },
            expiresAt: {
              type: "string",
              format: "date-time",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            invitedBy: {
              type: "object",
              required: ["id", "firstName", "lastName", "email"],
              properties: {
                id: {
                  type: "integer",
                },
                firstName: {
                  type: "string",
                },
                lastName: {
                  type: "string",
                },
                email: {
                  type: "string",
                  format: "email",
                },
              },
            },
          },
        },
        Clip: {
          type: "object",
          required: ["id", "team_id", "generated_by_user_id", "status", "saved", "created_at", "updated_at"],
          properties: {
            id: {
              type: "integer",
            },
            team_id: {
              type: "integer",
            },
            generated_by_user_id: {
              type: "integer",
            },
            folder_id: {
              type: "integer",
              nullable: true,
            },
            clip_path: {
              type: "string",
            },
            blank_video_path: {
              type: "string",
            },
            watermarked_clip_path: {
              type: "string",
            },
            srt_path: {
              type: "string",
            },
            captions_data: {
              type: "array",
              items: {
                $ref: "#/components/schemas/CaptionEntry",
              },
            },
            clip_score: {
              type: "integer",
            },
            source_video_path: {
              type: "string",
            },
            clip_metadata: {
              oneOf: [
                { type: "object", additionalProperties: {} },
                { type: "null" },
              ],
            },
            input_metadata: {
              oneOf: [
                { type: "object", additionalProperties: {} },
                { type: "null" },
              ],
            },
            prompt: {
              type: "string",
            },
            raw_video_id: {
              type: "integer",
              nullable: true,
            },
            raw_video_path: {
              type: "string",
            },
            title: {
              type: "string",
            },
            message: {
              type: "string",
            },
            status: {
              type: "string",
              enum: ["pending", "completed", "failed"],
            },
            saved: {
              type: "boolean",
            },
            share_token: {
              type: "string",
              nullable: true,
            },
            error_message: {
              type: "string",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
            updated_at: {
              type: "string",
              format: "date-time",
            },
            clipUrl: {
              type: "string",
            },
            sourceVideoUrl: {
              type: "string",
            },
            blankVideoUrl: {
              type: "string",
            },
            rawVideoUrl: {
              type: "string",
            },
            tags: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Tag",
              },
            },
          },
        },
        AdminLoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Admin email address",
            },
            password: {
              type: "string",
              description: "Admin password",
            },
          },
        },
        AdminLoginResponse: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT token for admin authentication",
            },
          },
        },
        AdminTeam: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "Team ID",
            },
            name: {
              type: "string",
              description: "Team name",
            },
            plan: {
              type: "string",
              enum: ["free", "creator", "studio", "scale", "enterprise"],
              description: "Current subscription plan",
            },
            clips_created: {
              type: "integer",
              description: "Credits Used this period",
            },
            clips_limit: {
              type: "integer",
              description: "Clips limit for current period",
            },
            enterprise_clip_limit: {
              type: "integer",
              nullable: true,
              description: "Custom clip limit for enterprise plans",
            },
            enterprise_monthly_price: {
              type: "integer",
              nullable: true,
              description: "Custom monthly price in cents for enterprise plans",
            },
            stripe_customer_id: {
              type: "string",
              nullable: true,
              description: "Stripe customer ID",
            },
            owner_email: {
              type: "string",
              description: "Team owner email",
            },
            member_count: {
              type: "integer",
              description: "Number of team members",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        EnterpriseSetupRequest: {
          type: "object",
          required: [
            "teamId",
            "clipLimit",
            "monthlyPriceCents",
            "customerEmail",
          ],
          properties: {
            teamId: {
              type: "string",
              description: "Team ID to upgrade",
            },
            clipLimit: {
              type: "integer",
              description: "Monthly clip limit for enterprise plan",
            },
            monthlyPriceCents: {
              type: "integer",
              description: "Monthly price in cents",
            },
            customerEmail: {
              type: "string",
              format: "email",
              description: "Customer email for Stripe",
            },
          },
        },
        EnterpriseSetupResponse: {
          type: "object",
          properties: {
            checkoutUrl: {
              type: "string",
              format: "uri",
              description: "Stripe checkout URL to share with customer",
            },
            team: {
              $ref: "#/components/schemas/AdminTeam",
            },
          },
        },
        ViralityAccount: {
          type: "object",
          required: [
            "id",
            "team_id",
            "platform",
            "account_type",
            "username",
            "profile_url",
            "is_verified",
            "alert_enabled",
            "is_active",
            "syncs_remaining",
            "sync_status",
            "last_synced_at",
            "created_at",
            "updated_at",
          ],
          properties: {
            id: { type: "integer" },
            team_id: { type: "integer" },
            competitor_id: { type: "integer", nullable: true },
            platform: { type: "string", enum: ["instagram", "tiktok", "x"] },
            account_type: { type: "string", enum: ["profile", "hashtag", "keyword"] },
            username: { type: "string" },
            profile_url: { type: "string" },
            display_name: { type: "string", nullable: true },
            avatar_url: { type: "string", nullable: true },
            bio: { type: "string", nullable: true },
            follower_count: { type: "integer", nullable: true },
            following_count: { type: "integer", nullable: true },
            total_likes: { type: "integer", nullable: true },
            post_count: { type: "integer", nullable: true },
            follower_history: {
              type: "array",
              nullable: true,
              items: {
                type: "object",
                required: ["recorded_at", "followers"],
                properties: {
                  recorded_at: { type: "string" },
                  followers: { type: "integer" },
                },
              },
            },
            is_verified: { type: "boolean" },
            alert_enabled: { type: "boolean" },
            is_active: { type: "boolean" },
            syncs_remaining: { type: "integer" },
            last_synced_at: { type: "string", format: "date-time", nullable: true },
            sync_status: { type: "string", enum: ["pending", "syncing", "completed", "failed"] },
            sync_error: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        ViralityPost: {
          type: "object",
          required: [
            "id",
            "account_id",
            "platform_post_id",
            "post_url",
            "thumbnail_url",
            "caption",
            "hashtags",
            "post_type",
            "posted_at",
            "like_count",
            "comment_count",
            "video_view_count",
            "video_play_count",
            "metrics_history",
            "mass_post_id",
            "campaign_name",
            "created_at",
            "updated_at",
          ],
          properties: {
            id: { type: "integer" },
            account_id: { type: "integer" },
            platform_post_id: { type: "string" },
            post_url: { type: "string" },
            thumbnail_url: { type: "string", nullable: true },
            caption: { type: "string", nullable: true },
            hashtags: { type: "array", items: { type: "string" } },
            post_type: { type: "string", nullable: true },
            posted_at: { type: "string", format: "date-time", nullable: true },
            like_count: { type: "integer" },
            comment_count: { type: "integer" },
            video_view_count: { type: "integer", nullable: true },
            video_play_count: { type: "integer", nullable: true },
            metrics_history: {
              type: "array",
              items: {
                type: "object",
                required: ["recorded_at", "likes", "comments"],
                properties: {
                  recorded_at: { type: "string" },
                  likes: { type: "integer" },
                  comments: { type: "integer" },
                  views: { type: "integer", nullable: true },
                },
              },
            },
            mass_post_id: { type: "integer", nullable: true },
            campaign_name: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        ViralityCompetitor: {
          type: "object",
          required: ["id", "team_id", "name", "created_at", "updated_at"],
          properties: {
            id: { type: "integer" },
            team_id: { type: "integer" },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        MoveAccountToGroupRequest: {
          type: "object",
          required: ["groupId"],
          properties: {
            groupId: { type: "integer", description: "Target group ID to move the account to" },
            isCompetitor: { type: "boolean", description: "Whether this is a competitor account (true) or user account (false)", default: true },
          },
        },
        MoveAccountToGroupResponse: {
          type: "object",
          required: ["success"],
          properties: {
            success: { type: "boolean" },
          },
        },
        DeleteGroupResponse: {
          type: "object",
          required: ["success"],
          properties: {
            success: { type: "boolean" },
          },
        },
        ViralityAccountListResponse: {
          type: "object",
          required: ["accounts"],
          properties: {
            accounts: { type: "array", items: { $ref: "#/components/schemas/ViralityAccount" } },
          },
        },
        ViralityAccountResponse: {
          type: "object",
          required: ["account"],
          properties: {
            account: { $ref: "#/components/schemas/ViralityAccount" },
          },
        },
        ViralityPostListResponse: {
          type: "object",
          required: ["posts"],
          properties: {
            posts: { type: "array", items: { $ref: "#/components/schemas/ViralityPost" } },
          },
        },
        ViralityCompetitorListResponse: {
          type: "object",
          required: ["competitors"],
          properties: {
            competitors: { type: "array", items: { $ref: "#/components/schemas/ViralityCompetitor" } },
          },
        },
        ViralityCompetitorResponse: {
          type: "object",
          required: ["competitor"],
          properties: {
            competitor: { $ref: "#/components/schemas/ViralityCompetitor" },
          },
        },
        SuccessResponse: {
          type: "object",
          required: ["success"],
          properties: {
            success: { type: "boolean" },
          },
        },
        SyncAcceptedResponse: {
          type: "object",
          required: ["accepted", "accountId"],
          properties: {
            accepted: { type: "boolean" },
            accountId: { type: "integer" },
          },
        },
        SyncAllAcceptedResponse: {
          type: "object",
          required: ["accepted", "accountIds"],
          properties: {
            accepted: { type: "boolean" },
            accountIds: { type: "array", items: { type: "integer" } },
          },
        },
        ViralSettingsResponse: {
          type: "object",
          required: ["settings"],
          properties: {
            settings: { $ref: "#/components/schemas/ViralSettings" },
          },
        },
        BackfillManagedResponse: {
          type: "object",
          required: ["created", "skipped"],
          properties: {
            created: { type: "integer" },
            skipped: { type: "integer" },
          },
        },
        BulkMoveAccountsRequest: {
          type: "object",
          required: ["sourceGroupId", "targetGroupId"],
          properties: {
            sourceGroupId: { type: "integer" },
            targetGroupId: { type: "integer" },
          },
        },
        BulkMoveAccountsResponse: {
          type: "object",
          required: ["moved"],
          properties: {
            moved: { type: "integer" },
          },
        },
        ViralSettings: {
          type: "object",
          required: [
            "percentThreshold",
            "absoluteThreshold",
            "thresholdMode",
            "timeFrameHours",
            "enabledAccountIds",
            "additionalEmails",
          ],
          properties: {
            percentThreshold: { type: "integer", nullable: true },
            absoluteThreshold: { type: "integer", nullable: true },
            thresholdMode: { type: "string", enum: ["and", "or"] },
            timeFrameHours: { type: "integer" },
            enabledAccountIds: { type: "array", items: { type: "integer" } },
            additionalEmails: { type: "array", items: { type: "string", format: "email" } },
            ownedPercentThreshold: { type: "integer" },
            ownedAbsoluteThreshold: { type: "integer" },
            ownedThresholdMode: { type: "string", enum: ["and", "or"] },
            ownedAlertsEnabled: { type: "boolean" },
            competitorPercentThreshold: { type: "integer" },
            competitorAbsoluteThreshold: { type: "integer" },
            competitorThresholdMode: { type: "string", enum: ["and", "or"] },
            competitorAlertsEnabled: { type: "boolean" },
          },
        },
        ViralAlertLog: {
          type: "object",
          required: ["id", "team_id", "email", "subject", "email_body", "viral_post_ids", "status", "sent_at", "created_at"],
          properties: {
            id: { type: "integer" },
            team_id: { type: "integer" },
            user_id: { type: "integer", nullable: true },
            email: { type: "string" },
            subject: { type: "string" },
            email_body: { type: "string" },
            viral_post_ids: { type: "array", items: { type: "integer" } },
            alert_posts_snapshot: { type: "array", items: { type: "object" } },
            status: { type: "string", enum: ["sent", "failed"] },
            error_message: { type: "string", nullable: true },
            sent_at: { type: "string", format: "date-time" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        AlertLogsResponse: {
          type: "object",
          required: ["logs", "total"],
          properties: {
            logs: { type: "array", items: { $ref: "#/components/schemas/ViralAlertLog" } },
            total: { type: "integer" },
          },
        },
        NotifyAlertResponse: {
          type: "object",
          required: ["success"],
          properties: {
            success: { type: "boolean" },
          },
        },
        Campaign: {
          type: "object",
          required: [
            "id",
            "team_id",
            "name",
            "status",
            "videos_ready",
            "payment_ready",
            "contract_ready",
            "created_at",
            "updated_at",
          ],
          properties: {
            id: { type: "integer" },
            team_id: { type: "integer" },
            intake_form_id: { type: "integer", nullable: true },
            name: { type: "string" },
            status: {
              type: "string",
              enum: ["pending", "accepted", "rejected", "appeal", "started", "paused", "completed"],
            },
            quoted_cpm: { type: "string", nullable: true },
            budget: { type: "string", nullable: true },
            video_minimum: { type: "integer", nullable: true },
            minimum_fund: { type: "string", nullable: true },
            rejection_reason: { type: "string", nullable: true },
            admin_notes: { type: "string", nullable: true },
            google_drive_folder_id: { type: "string", nullable: true },
            videos_ready: { type: "boolean" },
            payment_ready: { type: "boolean" },
            contract_ready: { type: "boolean" },
            started_at: { type: "string", format: "date-time", nullable: true },
            completed_at: { type: "string", format: "date-time", nullable: true },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        CampaignVideo: {
          type: "object",
          required: [
            "id",
            "campaign_id",
            "status",
            "post_count",
            "user_post_count",
            "publish_status",
            "created_at",
          ],
          properties: {
            id: { type: "integer" },
            campaign_id: { type: "integer" },
            clip_id: { type: "integer", nullable: true },
            file_name: { type: "string", nullable: true },
            title: { type: "string", nullable: true },
            duration_seconds: { type: "number", nullable: true },
            presigned_url: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["pending", "uploaded", "processing", "ready", "failed"],
            },
            post_count: { type: "integer" },
            user_post_count: { type: "integer" },
            publish_status: {
              type: "string",
              enum: ["waiting_assignment", "in_drive", "published"],
            },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        CampaignPaymentMethod: {
          type: "object",
          required: ["type", "last4"],
          properties: {
            type: { type: "string", enum: ["card", "us_bank_account"] },
            brand: { type: "string" },
            last4: { type: "string" },
            exp_month: { type: "integer" },
            exp_year: { type: "integer" },
            bank_name: { type: "string" },
          },
        },
        CampaignWallet: {
          type: "object",
          required: [
            "id",
            "campaign_id",
            "balance_cents",
            "total_deposited_cents",
            "total_spent_cents",
            "created_at",
            "updated_at",
          ],
          properties: {
            id: { type: "integer" },
            campaign_id: { type: "integer" },
            team_id: { type: "integer" },
            balance_cents: { type: "integer" },
            total_deposited_cents: { type: "integer" },
            total_spent_cents: { type: "integer" },
            stripe_payment_method_id: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        MasterAgreement: {
          type: "object",
          required: ["id", "team_id", "status"],
          properties: {
            id: { type: "integer" },
            team_id: { type: "integer" },
            status: { type: "string", enum: ["pending", "signed", "voided"] },
            signer_name: { type: "string", nullable: true },
            signer_legal_entity_name: { type: "string", nullable: true },
            signer_title: { type: "string", nullable: true },
            signer_email: { type: "string", nullable: true },
            presigned_pdf_url: { type: "string", nullable: true },
            signed_at: { type: "string", format: "date-time", nullable: true },
            effective_date: { type: "string", format: "date-time", nullable: true },
            created_at: { type: "string", format: "date-time", nullable: true },
            updated_at: { type: "string", format: "date-time", nullable: true },
          },
        },
        CampaignGates: {
          type: "object",
          required: ["videos", "payment", "contract"],
          properties: {
            videos: {
              type: "object",
              required: ["complete", "videoCount", "videoMinimum"],
              properties: {
                complete: { type: "boolean" },
                videoCount: { type: "integer" },
                videoMinimum: { type: "integer" },
              },
            },
            payment: {
              type: "object",
              required: ["complete", "balanceCents", "requiredCents"],
              properties: {
                complete: { type: "boolean" },
                balanceCents: { type: "integer" },
                requiredCents: { type: "integer" },
              },
            },
            contract: {
              type: "object",
              required: ["complete"],
              properties: {
                complete: { type: "boolean" },
                signedAt: { type: "string", format: "date-time", nullable: true },
              },
            },
          },
        },
        CpmDailyCharge: {
          type: "object",
          required: [
            "id",
            "chargeDate",
            "totalViewsDelta",
            "cpmRate",
            "chargeCents",
            "status",
            "postBreakdown",
            "createdAt",
          ],
          properties: {
            id: { type: "integer" },
            chargeDate: { type: "string" },
            totalViewsDelta: { type: "integer" },
            cpmRate: { type: "string" },
            chargeCents: { type: "integer" },
            source: { type: "string", enum: ["wallet", "card"], nullable: true },
            status: { type: "string", enum: ["charged", "failed", "waived"] },
            failureReason: { type: "string", nullable: true },
            postBreakdown: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "user_post_id",
                  "previous_views",
                  "current_views",
                  "delta_views",
                  "charge_cents",
                ],
                properties: {
                  user_post_id: { type: "integer" },
                  previous_views: { type: "integer" },
                  current_views: { type: "integer" },
                  delta_views: { type: "integer" },
                  charge_cents: { type: "integer" },
                  post_url: { type: "string", nullable: true },
                },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        PresignedUploadResponse: {
          type: "object",
          required: ["uploadUrl", "s3Key"],
          properties: {
            uploadUrl: { type: "string" },
            s3Key: { type: "string" },
          },
        },
        MultipartUploadResponse: {
          type: "object",
          required: ["uploadId", "s3Key", "chunkSize", "totalParts", "partUrls"],
          properties: {
            uploadId: { type: "string" },
            s3Key: { type: "string" },
            chunkSize: { type: "integer" },
            totalParts: { type: "integer" },
            partUrls: {
              type: "array",
              items: {
                type: "object",
                required: ["partNumber", "uploadUrl"],
                properties: {
                  partNumber: { type: "integer" },
                  uploadUrl: { type: "string" },
                },
              },
            },
          },
        },
        SubmitClipResponse: {
          type: "object",
          required: ["clipIds", "message", "status"],
          properties: {
            clipIds: { type: "array", items: { type: "integer" } },
            message: { type: "string" },
            status: { type: "string" },
          },
        },
        VideoUrlInfo: {
          type: "object",
          required: ["title", "duration", "filesize", "thumbnail", "uploader", "platform"],
          properties: {
            title: { type: "string" },
            duration: { type: "number" },
            filesize: { type: "number" },
            thumbnail: { type: "string" },
            uploader: { type: "string" },
            platform: { type: "string" },
          },
        },
        GenerateSceneImagesResponse: {
          type: "object",
          required: ["success", "jobId", "sceneId", "status", "message"],
          properties: {
            success: { type: "boolean" },
            jobId: { type: "string", format: "uuid" },
            sceneId: { type: "string" },
            status: { type: "string", enum: ["queued"] },
            singleBRollShotIndex: { type: "integer", nullable: true },
            message: { type: "string" },
          },
        },
        GenerateAllSceneImagesResponse: {
          type: "object",
          required: ["success", "jobIds", "message"],
          properties: {
            success: { type: "boolean" },
            jobIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
            message: { type: "string" },
          },
        },
        SceneGenerationStatus: {
          type: "object",
          required: [
            "success",
            "jobId",
            "sceneId",
            "sceneNumber",
            "status",
            "progress",
            "progressMessage",
            "createdAt",
          ],
          properties: {
            success: { type: "boolean" },
            jobId: { type: "string", format: "uuid" },
            sceneId: { type: "string" },
            sceneNumber: { type: "integer" },
            status: {
              type: "string",
              enum: ["queued", "generating", "completed", "failed"],
            },
            progress: { type: "integer" },
            progressMessage: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            startedAt: { type: "string", format: "date-time", nullable: true },
            completedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            images: {
              type: "array",
              items: {
                type: "object",
                required: ["key", "url", "index"],
                properties: {
                  key: { type: "string" },
                  url: { type: "string" },
                  index: { type: "integer" },
                },
              },
            },
            error: { type: "string" },
          },
        },
        SceneImagesResponse: {
          type: "object",
          required: ["success", "sceneImages"],
          properties: {
            success: { type: "boolean" },
            sceneImages: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  script_id: { type: "string" },
                  scene_id: { type: "string" },
                  scene_number: { type: "integer" },
                  image_key: { type: "string" },
                  imageUrl: { type: "string" },
                  generatedImages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        url: { type: "string" },
                        index: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        SceneUploadUrlResponse: {
          type: "object",
          required: ["success", "uploadUrl", "s3Key"],
          properties: {
            success: { type: "boolean" },
            uploadUrl: { type: "string", format: "uri" },
            s3Key: { type: "string" },
          },
        },
        AdCloneCreateResponse: {
          type: "object",
          required: ["success", "projectId", "uploadUrls"],
          properties: {
            success: { type: "boolean" },
            projectId: { type: "string", format: "uuid" },
            uploadUrls: {
              type: "object",
              required: ["video", "productImages"],
              properties: {
                video: {
                  type: "object",
                  required: ["uploadUrl", "s3Key"],
                  properties: {
                    uploadUrl: { type: "string" },
                    s3Key: { type: "string" },
                  },
                },
                productImages: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["uploadUrl", "s3Key"],
                    properties: {
                      uploadUrl: { type: "string" },
                      s3Key: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        AdCloneUploadUrlsResponse: {
          type: "object",
          required: ["success", "uploadUrls"],
          properties: {
            success: { type: "boolean" },
            uploadUrls: {
              type: "object",
              required: ["video", "productImages"],
              properties: {
                video: {
                  type: "object",
                  required: ["uploadUrl", "s3Key"],
                  properties: {
                    uploadUrl: { type: "string" },
                    s3Key: { type: "string" },
                  },
                },
                productImages: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["uploadUrl", "s3Key"],
                    properties: {
                      uploadUrl: { type: "string" },
                      s3Key: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        AdCloneProjectStatus: {
          type: "object",
          required: [
            "success",
            "projectId",
            "status",
            "progress",
            "progressMessage",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            success: { type: "boolean" },
            projectId: { type: "string", format: "uuid" },
            status: {
              type: "string",
              enum: [
                "created",
                "uploading",
                "analyzing",
                "analysis_complete",
                "generating_script",
                "script_generated",
                "generating_video",
                "completed",
                "failed",
              ],
            },
            progress: { type: "integer" },
            progressMessage: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            hasAnalysis: { type: "boolean" },
            hasScript: { type: "boolean" },
            script: { type: "object" },
            finalVideoUrl: { type: "string" },
            clipId: { type: "integer" },
            error: { type: "string" },
          },
        },
        GenerateGraphicsResponse: {
          type: "object",
          required: ["success", "images"],
          properties: {
            success: { type: "boolean" },
            images: {
              type: "array",
              items: {
                type: "object",
                required: ["s3Key", "presignedUrl"],
                properties: {
                  s3Key: { type: "string" },
                  presignedUrl: { type: "string" },
                },
              },
            },
          },
        },
        GraphicsUploadUrlResponse: {
          type: "object",
          required: ["success", "uploadUrl", "s3Key"],
          properties: {
            success: { type: "boolean" },
            uploadUrl: { type: "string", format: "uri" },
            s3Key: { type: "string" },
          },
        },
        CloneVoiceResponse: {
          type: "object",
          required: ["success", "voice"],
          properties: {
            success: { type: "boolean" },
            voice: {
              type: "object",
              required: ["id", "name", "voiceId", "previewUrl", "gender"],
              properties: {
                id: { type: "integer" },
                name: { type: "string" },
                voiceId: { type: "string" },
                previewUrl: { type: "string", format: "uri" },
                gender: { type: "string", enum: ["male", "female", "other"] },
              },
            },
          },
        },
        ListVoiceClonesResponse: {
          type: "object",
          required: ["success", "voices"],
          properties: {
            success: { type: "boolean" },
            voices: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "id",
                  "name",
                  "voiceId",
                  "previewUrl",
                  "gender",
                  "createdAt",
                ],
                properties: {
                  id: { type: "integer" },
                  name: { type: "string" },
                  voiceId: { type: "string" },
                  previewUrl: { type: "string", format: "uri" },
                  gender: {
                    type: "string",
                    enum: ["male", "female", "other"],
                  },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        ApiKeyListResponse: {
          type: "object",
          required: ["keys"],
          properties: {
            keys: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "id",
                  "name",
                  "key_prefix",
                  "revoked",
                  "created_at",
                ],
                properties: {
                  id: { type: "integer" },
                  name: { type: "string" },
                  key_prefix: { type: "string" },
                  revoked: { type: "boolean" },
                  last_used_at: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                  expires_at: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                  created_at: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        ApiKeyCreateResponse: {
          type: "object",
          required: ["id", "name", "key", "key_prefix", "created_at"],
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            key: { type: "string" },
            key_prefix: { type: "string" },
            expires_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            created_at: { type: "string", format: "date-time" },
          },
        },
        PlatformWallet: {
          type: "object",
          required: [
            "balance_cents",
            "total_spent_cents",
            "total_topped_up_cents",
            "active",
          ],
          properties: {
            balance_cents: { type: "integer" },
            total_spent_cents: { type: "integer" },
            total_topped_up_cents: { type: "integer" },
            active: { type: "boolean" },
          },
        },
        PlatformAutoRefillSettings: {
          type: "object",
          required: [
            "auto_refill",
            "refill_threshold_cents",
            "refill_amount_cents",
            "has_payment_method",
          ],
          properties: {
            auto_refill: { type: "boolean" },
            refill_threshold_cents: { type: "integer" },
            refill_amount_cents: { type: "integer" },
            has_payment_method: { type: "boolean" },
          },
        },
        TeamUsageStats: {
          type: "object",
          required: [
            "teamId",
            "teamName",
            "clipsCreated",
            "baseLimit",
            "baseRemaining",
            "addonRemaining",
            "totalRemaining",
            "clipsGenerated",
            "generationLimit",
            "generationsRemaining",
            "resetsDate",
            "rollover",
            "limit",
            "remaining",
          ],
          properties: {
            teamId: { type: "integer" },
            teamName: { type: "string" },
            clipsCreated: { type: "integer" },
            baseLimit: { type: "integer" },
            baseRemaining: { type: "integer" },
            addonRemaining: { type: "integer" },
            totalRemaining: { type: "integer" },
            clipsGenerated: { type: "integer" },
            generationLimit: { type: "integer" },
            generationsRemaining: { type: "integer" },
            resetsDate: { type: "string", format: "date-time" },
            rollover: { type: "boolean" },
            limit: { type: "integer" },
            remaining: { type: "integer" },
          },
        },
        ViralityDashboard: {
          type: "object",
          required: [
            "accountsCount",
            "totalFollowers",
            "totalLikes",
            "totalPosts",
            "totalViews",
            "avgViewsPerPost",
            "accountPostStats",
            "accounts",
          ],
          properties: {
            accountsCount: { type: "integer" },
            totalFollowers: { type: "integer" },
            totalLikes: { type: "integer" },
            totalPosts: { type: "integer" },
            totalViews: { type: "integer" },
            avgViewsPerPost: { type: "integer" },
            accountPostStats: {
              type: "object",
              additionalProperties: {
                type: "object",
                required: ["totalViews", "postCount"],
                properties: {
                  totalViews: { type: "integer" },
                  postCount: { type: "integer" },
                },
              },
            },
            accounts: {
              type: "array",
              items: { $ref: "#/components/schemas/ViralityAccount" },
            },
          },
        },
        CompetitorWithAccounts: {
          allOf: [
            { $ref: "#/components/schemas/ViralityCompetitor" },
            {
              type: "object",
              required: ["accounts"],
              properties: {
                accounts: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ViralityAccount" },
                },
              },
            },
          ],
        },
        ViralityPostsByAccount: {
          type: "object",
          required: ["postsByAccount"],
          properties: {
            postsByAccount: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: { $ref: "#/components/schemas/ViralityPost" },
              },
            },
          },
        },
        IntakeApplicationStatus: {
          type: "object",
          required: [
            "hasIntakeForm",
            "intakeFormCompleted",
            "applicationStatus",
            "googleDriveFolderId",
          ],
          properties: {
            hasIntakeForm: { type: "boolean" },
            intakeFormCompleted: { type: "boolean" },
            applicationStatus: { type: "string", nullable: true },
            googleDriveFolderId: { type: "string", nullable: true },
          },
        },
        ClipPostsResponse: {
          type: "object",
          required: ["posts"],
          properties: {
            posts: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "platform", "status", "created_at"],
                properties: {
                  id: { type: "integer" },
                  platform: { type: "string" },
                  status: { type: "string" },
                  post_url: { type: "string", nullable: true },
                  drive_file_id: { type: "string", nullable: true },
                  posted_time: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                  created_at: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        CpmBillingBreakdown: {
          type: "object",
          required: ["summary", "dailyCharges"],
          properties: {
            summary: {
              type: "object",
              required: [
                "totalChargedCents",
                "totalViews",
                "walletSpentCents",
                "cardChargedCents",
                "cpmRate",
                "daysTracked",
              ],
              properties: {
                totalChargedCents: { type: "integer" },
                totalViews: { type: "integer" },
                walletSpentCents: { type: "integer" },
                cardChargedCents: { type: "integer" },
                cpmRate: { type: "string", nullable: true },
                daysTracked: { type: "integer" },
              },
            },
            dailyCharges: {
              type: "array",
              items: { $ref: "#/components/schemas/CpmDailyCharge" },
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
