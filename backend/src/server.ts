import "./instrument";
import * as Sentry from "@sentry/node";
import { createServer } from "http";
import app from "./app";
import "./config/env";
import { initializeSocket } from "./services/socket.service";
import { initializeTempCleanup, stopTempCleanup } from "./utils/tempCleanup";

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

async function startServer() {
  initializeTempCleanup();
  await initializeSocket(httpServer);
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  stopTempCleanup();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
