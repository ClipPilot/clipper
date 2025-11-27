import express from "express";
import transcribeRoutes from "./routes/transcribe.routes";

const app = express();

app.use(express.json());

app.use("/transcribe", transcribeRoutes);

export default app;
