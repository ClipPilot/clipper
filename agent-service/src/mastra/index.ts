import { createServer } from "node:http";
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { PostgresStore } from "@mastra/pg";
import { scriptInitAgent } from "./agents/scriptInit-agent.js";
import { scriptAgent } from "./agents/script-agent.js";
import { adDeconstructorAgent } from "./agents/adDeconstructor-agent.js";
import { storyboardAgent } from "./agents/storyboard-agent.js";
import { videoAnalysisAgent } from "./agents/videoAnalysis-agent.js";

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || "4112");

createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end('{"status":"ok"}');
}).listen(HEALTH_PORT, "0.0.0.0");

export const mastra = new Mastra({
  server: {
    port: parseInt(process.env.PORT || "4111"),
    host: "0.0.0.0",
  },
  agents: { scriptInitAgent, scriptAgent, adDeconstructorAgent, storyboardAgent, videoAnalysisAgent },
  storage: new PostgresStore({
    id: "postgres-store",
    connectionString: process.env.DATABASE_URL!,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
