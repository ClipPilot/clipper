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
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
