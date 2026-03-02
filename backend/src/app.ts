import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import transcribeRoutes from "./routes/clip.routes";
import authRoutes from "./routes/auth.routes";
import teamRoutes from "./routes/team.routes";
import folderRoutes from "./routes/folder.routes";
import tagRoutes from "./routes/tag.routes";
import internalRoutes from "./routes/internal.routes";
import stripeRoutes from "./routes/stripe.routes";
import comfyRoutes from "./routes/comfy.routes";
import faceSwapRoutes from "./routes/faceSwap.routes";
import adminRoutes from "./routes/admin.routes";
import referralRoutes from "./routes/referral.routes";
import actorRoutes from "./routes/actor.routes";
import ugcScriptRoutes from "./routes/ugcScript.routes";
import sceneBuilderRoutes from "./routes/sceneBuilder.routes";
import ugcVideoRoutes from "./routes/ugcVideo.routes";
import userPreferencesRoutes from "./routes/userPreferences.routes";
import adCloneRoutes from "./routes/adClone.routes";
import graphicsRoutes from "./routes/graphics.routes";
import announcementRoutes from "./routes/announcement.routes";
import intakeRoutes from "./routes/intake.routes";
import adPostingRoutes from "./routes/adPosting.routes";
import viralityRoutes from "./routes/virality.routes";
import userPerformanceRoutes from "./routes/userPerformance.routes";
import voiceCloneRoutes from "./routes/voiceClone.routes";
import apiPlatformRoutes from "./routes/api-platform/main.routes";
import campaignRoutes from "./routes/campaign.routes";
import incidentRoutes from "./routes/incident.routes";
import { swaggerSpec } from "./config/swagger";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3002",
      "http://localhost:3003",
      "https://platform.cuttr.com",
      "https://www.platform.cuttr.com",
      "https://beta.cuttr.com",
      "https://www.beta.cuttr.com",
      "https://cuttr.com",
      "https://www.cuttr.com",
      "https://admin.cuttr.com",
      "https://status.cuttr.com",
      "https://status-staging.cuttr.com",
      "https://va.cuttr.com",
      "https://va-staging.cuttr.com",
    ],
    credentials: true,
  }),
);

app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "10gb" }));
app.use(express.urlencoded({ limit: "10gb", extended: true }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "clipster-backend",
  });
});

app.get("/health/worker", async (req, res) => {
  try {
    const { SQSClient, GetQueueAttributesCommand } = await import("@aws-sdk/client-sqs");
    const { ECSClient, DescribeServicesCommand } = await import("@aws-sdk/client-ecs");
    const region = process.env.AWS_REGION || "us-west-2";

    const [sqsResult, ecsResult] = await Promise.all([
      new SQSClient({ region }).send(
        new GetQueueAttributesCommand({
          QueueUrl: process.env.SQS_QUEUE_URL,
          AttributeNames: ["ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible"],
        })
      ),
      new ECSClient({ region }).send(
        new DescribeServicesCommand({
          cluster: process.env.ECS_CLUSTER_NAME || "clipster-cluster-prod",
          services: [process.env.ECS_WORKER_SERVICE_NAME || "clipster-worker-service-prod"],
        })
      ),
    ]);

    const queueDepth = parseInt(sqsResult.Attributes?.ApproximateNumberOfMessages || "0");
    const inFlight = parseInt(sqsResult.Attributes?.ApproximateNumberOfMessagesNotVisible || "0");
    const svc = ecsResult.services?.[0];
    const runningTasks = svc?.runningCount ?? 0;
    const desiredTasks = svc?.desiredCount ?? 0;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (runningTasks === 0 && desiredTasks > 0) status = "unhealthy";
    else if (runningTasks < desiredTasks || queueDepth > 50) status = "degraded";

    res.status(status === "unhealthy" ? 503 : 200).json({
      status,
      timestamp: new Date().toISOString(),
      service: "clipster-worker",
      queue: { depth: queueDepth, inFlight },
      ecs: { running: runningTasks, desired: desiredTasks },
    });
  } catch (err: any) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "clipster-worker",
      error: err.message,
    });
  }
});

app.use("/internal", internalRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/clip-video", transcribeRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/c", comfyRoutes);
app.use("/api/face-swap", faceSwapRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/actors", actorRoutes);
app.use("/api/ugc", ugcScriptRoutes);
app.use("/api/scene-builder", sceneBuilderRoutes);
app.use("/api/ugc-video", ugcVideoRoutes);
app.use("/api/user/preferences", userPreferencesRoutes);
app.use("/api/ad-clone", adCloneRoutes);
app.use("/api/graphics", graphicsRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/intake", intakeRoutes);
app.use("/api/ad-posting", adPostingRoutes);
app.use("/api/virality", viralityRoutes);
app.use("/api/user-performance", userPerformanceRoutes);
app.use("/api/voice-clones", voiceCloneRoutes);
app.use("/api/platform", apiPlatformRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/incidents", incidentRoutes);

app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err instanceof multer.MulterError) {
      console.error("[multer] Error:", err.code, err.message);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .json({ error: "File too large. Maximum size is 100MB." });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res
          .status(400)
          .json({
            error: "Too many files. Maximum is 11 (1 video + 10 images).",
          });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ error: "Unexpected file field." });
      }
      return res.status(400).json({ error: err.message });
    }
    if (
      err.message?.includes("Invalid file type") ||
      err.message?.includes("Invalid video type") ||
      err.message?.includes("Invalid image type")
    ) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  },
);

// Sentry error handler must be after all controllers
Sentry.setupExpressErrorHandler(app);

export default app;
