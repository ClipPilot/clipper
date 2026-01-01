import { createServer } from "http";
import app from "./app";
import "./config/env";
import { initializeSocket } from "./services/socket.service";
import { startComfyWorker, stopComfyWorker } from "./services/comfy.worker";

const PORT = process.env.PORT || 3000;
const ENABLE_COMFY_WORKER = process.env.ENABLE_COMFY_WORKER !== "false";

const httpServer = createServer(app);

async function startServer() {
  await initializeSocket(httpServer);

  // Start ComfyUI worker if enabled
  if (ENABLE_COMFY_WORKER) {
    startComfyWorker();
    console.log("ComfyUI worker started");
  }

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  stopComfyWorker();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
