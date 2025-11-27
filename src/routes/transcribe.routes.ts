import { Router } from "express";
import multer from "multer";
import { transcribeVideoController } from "../controllers/transcribe.controller";

const upload = multer({ dest: "uploads/" });
const router = Router();

router.post("/", transcribeVideoController);

export default router;