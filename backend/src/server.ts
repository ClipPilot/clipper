import { createServer } from "http";
import app from "./app";
import "./config/env";
import { initializeSocket } from "./services/socket.service";

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
});

const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);

async function startServer() {
  await initializeSocket(httpServer);

  // Note: GPU face swap jobs are now handled by separate SQS-based GPU worker (gpu-worker/)
  // The old comfy.worker.ts polling approach has been replaced

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
