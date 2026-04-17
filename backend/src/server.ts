import "./instrument";
import * as Sentry from "@sentry/node";
import { createServer } from "http";
import app from "./app";
import "./config/env";
import { initializeSocket } from "./services/socket.service";
import { initializeTempCleanup, stopTempCleanup } from "./utils/tempCleanup";
import { closeDatabase } from "./db";
import { closeRedis } from "./services/redis.service";
import { flushPendingApiKeyUsage } from "./middleware/auth.middleware";

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error.message);
  Sentry.captureException(error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
  Sentry.captureException(reason);
});

const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);

httpServer.keepAliveTimeout = 75_000;
httpServer.headersTimeout = 80_000;
httpServer.requestTimeout = 65_000;
httpServer.timeout = 0;

let usageFlushInterval: NodeJS.Timeout | null = null;

async function startServer() {
  initializeTempCleanup();
  await initializeSocket(httpServer);

  usageFlushInterval = setInterval(() => {
    flushPendingApiKeyUsage().catch((err) => {
      console.error("[apikey-usage-flush] failed:", err?.message || err);
    });
  }, 60_000);
  usageFlushInterval.unref?.();

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);

  if (usageFlushInterval) {
    clearInterval(usageFlushInterval);
    usageFlushInterval = null;
  }
  stopTempCleanup();

  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 25_000);
  forceExit.unref?.();

  httpServer.close(async () => {
    try {
      await flushPendingApiKeyUsage().catch(() => 0);
      await Promise.allSettled([closeDatabase(), closeRedis()]);
    } finally {
      clearTimeout(forceExit);
      console.log("Server closed");
      process.exit(0);
    }
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
