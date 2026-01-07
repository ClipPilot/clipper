import express from "express";
import cors from "cors";
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
    ],
    credentials: true,
  })
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

app.use("/internal", internalRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/clip-video", transcribeRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/comfy", comfyRoutes);
app.use("/api/face-swap", faceSwapRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/referrals", referralRoutes);

export default app;
