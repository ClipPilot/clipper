import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import transcribeRoutes from "./routes/clip.routes";
import authRoutes from "./routes/auth.routes";
import teamRoutes from "./routes/team.routes";
import folderRoutes from "./routes/folder.routes";
import { swaggerSpec } from "./config/swagger";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "10gb" }));
app.use(express.urlencoded({ limit: "10gb", extended: true }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/clip-video", transcribeRoutes);
app.use("/api/folders", folderRoutes);

export default app;
