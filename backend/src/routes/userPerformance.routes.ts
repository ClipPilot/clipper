import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { userPerformanceController } from "../controllers/userPerformance.controller";

const router = Router();

router.get("/:teamId/accounts", requireAuth, (req, res) => userPerformanceController.listAccounts(req, res));
router.post("/:teamId/accounts", requireAuth, (req, res) => userPerformanceController.addAccount(req, res));
router.get("/:teamId/accounts/:accountId", requireAuth, (req, res) => userPerformanceController.getAccount(req, res));
router.delete("/:teamId/accounts/:accountId", requireAuth, (req, res) => userPerformanceController.deleteAccount(req, res));
router.patch("/:teamId/accounts/:accountId/status", requireAuth, (req, res) => userPerformanceController.updateAccountStatus(req, res));
router.post("/:teamId/accounts/:accountId/sync", requireAuth, (req, res) => userPerformanceController.syncAccount(req, res));
router.get("/:teamId/accounts/:accountId/posts", requireAuth, (req, res) => userPerformanceController.getPosts(req, res));
router.get("/:teamId/dashboard", requireAuth, (req, res) => userPerformanceController.getDashboard(req, res));

export default router;
