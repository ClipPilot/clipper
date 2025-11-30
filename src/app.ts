import express from "express";
import transcribeRoutes from "./routes/clip.routes";

const app = express();

app.use(express.json());

app.use("/clip-video", transcribeRoutes);

export default app;
