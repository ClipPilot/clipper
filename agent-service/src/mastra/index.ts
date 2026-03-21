import { Mastra } from "@mastra/core/mastra";
import { registerApiRoute } from "@mastra/core/server";
import { PinoLogger } from "@mastra/loggers";
import { PostgresStore } from "@mastra/pg";
import {
  Observability,
  DefaultExporter,
  CloudExporter,
  SensitiveDataFilter,
} from "@mastra/observability";
import { weatherWorkflow } from "./workflows/weather-workflow.js";
import { weatherAgent } from "./agents/weather-agent.js";
import { scriptInitAgent } from "./agents/scriptInit-agent.js";
import { scriptAgent } from "./agents/script-agent.js";
import { adDeconstructorAgent } from "./agents/adDeconstructor-agent.js";
import { storyboardAgent } from "./agents/storyboard-agent.js";

export const mastra = new Mastra({
  server: {
    port: parseInt(process.env.PORT || "4111"),
    host: "0.0.0.0",
    apiRoutes: [
      registerApiRoute("/health", {
        method: "GET",
        handler: async (c) => {
          return c.json({ status: "ok" });
        },
      }),
    ],
  },
  agents: { scriptInitAgent, scriptAgent, adDeconstructorAgent, storyboardAgent },
  storage: new PostgresStore({
    id: "postgres-store",
    connectionString: process.env.DATABASE_URL!,
    max: 5,
    idleTimeoutMillis: 10000,
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
