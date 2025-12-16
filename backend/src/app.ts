import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import transcribeRoutes from "./routes/clip.routes";
import authRoutes from "./routes/auth.routes";
import teamRoutes from "./routes/team.routes";
import folderRoutes from "./routes/folder.routes";
import internalRoutes from "./routes/internal.routes";
import stripeRoutes from "./routes/stripe.routes";
import { swaggerSpec } from "./config/swagger";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://platform.cuttr.com",
      "https://www.platform.cuttr.com",
      "https://beta.cuttr.com",
      "https://www.beta.cuttr.com",
      "https://cuttr.com",
      "https://www.cuttr.com",
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
app.use("/api/stripe", stripeRoutes);

export default app;
