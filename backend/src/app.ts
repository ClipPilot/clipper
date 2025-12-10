import express from "express";
import swaggerUi from "swagger-ui-express";
import transcribeRoutes from "./routes/clip.routes";
import { swaggerSpec } from "./config/swagger";

const app = express();

// Increase payload size limits for large video file uploads
app.use(express.json({ limit: "10gb" }));
app.use(express.urlencoded({ limit: "10gb", extended: true }));

// Swagger documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/clip-video", transcribeRoutes);

export default app;
