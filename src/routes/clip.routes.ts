import { Router } from "express";
import { clipVideoController } from "../controllers/clip.controller";

const router = Router();

router.post("/", clipVideoController);

export default router;