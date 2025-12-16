import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AI Video Clipper API",
      version: "1.0.0",
      description: "API for automatically generating short-form video clips from long-form content using AI",
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
          properties: {
            id: {
              type: "string",
              description: "User ID",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
            first_name: {
              type: "string",
              description: "User's first name",
            },
            last_name: {
              type: "string",
              description: "User's last name",
            },
            role: {
              type: "string",
              description: "User role",
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
              description: "Error message describing what went wrong",
            },
          },
        },
        Subscription: {
          type: "object",
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
              enum: ["free", "studio", "scale"],
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
              description: "Number of clips created this period",
            },
            limit: {
              type: "integer",
              description: "Maximum clips allowed per period",
            },
            remaining: {
              type: "integer",
              description: "Remaining clips this period",
            },
            resetsDate: {
              type: "string",
              format: "date-time",
              description: "When the usage resets",
            },
            plan: {
              type: "string",
              enum: ["free", "studio", "scale"],
              description: "Current plan name",
            },
          },
        },
        Team: {
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
            type: {
              type: "string",
              enum: ["personal", "business", "enterprise"],
              description: "Team type",
            },
            plan: {
              type: "string",
              enum: ["free", "studio", "scale"],
              description: "Current subscription plan",
            },
            role: {
              type: "string",
              enum: ["owner", "manager", "member"],
              description: "User's role in the team",
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
          properties: {
            id: {
              type: "integer",
              description: "Folder ID",
            },
            team_id: {
              type: "integer",
              description: "Team ID",
            },
            name: {
              type: "string",
              description: "Folder name",
            },
            color: {
              type: "string",
              description: "Folder color (hex)",
            },
            message: {
              type: "string",
              description: "Folder description",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Clip: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "Clip ID",
            },
            team_id: {
              type: "integer",
              description: "Team ID",
            },
            generated_by_user_id: {
              type: "integer",
              description: "User who generated the clip",
            },
            folder_id: {
              type: "integer",
              nullable: true,
              description: "Folder ID if assigned",
            },
            clip_path: {
              type: "string",
              description: "S3 path to the clip video",
            },
            blank_video_path: {
              type: "string",
              description: "S3 path to video without captions",
            },
            srt_path: {
              type: "string",
              description: "S3 path to SRT subtitle file",
            },
            captions_data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "integer" },
                  startTime: { type: "number" },
                  endTime: { type: "number" },
                  text: { type: "string" },
                },
              },
              description: "Caption timing and text data",
            },
            clip_score: {
              type: "integer",
              description: "Quality score of the clip",
            },
            source_video_path: {
              type: "string",
              description: "Original source video path",
            },
            clip_metadata: {
              type: "object",
              description: "Additional clip metadata",
            },
            title: {
              type: "string",
              description: "Clip title",
            },
            message: {
              type: "string",
              description: "User note about the clip",
            },
            status: {
              type: "string",
              enum: ["pending", "completed", "failed"],
              description: "Clip processing status",
            },
            error_message: {
              type: "string",
              description: "Error message if processing failed",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
