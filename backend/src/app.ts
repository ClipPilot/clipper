import express from "express";
import swaggerUi from "swagger-ui-express";
import transcribeRoutes from "./routes/clip.routes";
import { swaggerSpec } from "./config/swagger";

const app = express();

app.use(express.json());

// Swagger documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/clip-video", transcribeRoutes);

export default app;
