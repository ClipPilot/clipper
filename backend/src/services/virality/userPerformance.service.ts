import { userAccounts, userPosts } from "@clipper/shared-db/src/schema";
import { AccountTrackingService } from "./accountTracking.service";

export const userPerformanceService = new AccountTrackingService(userAccounts, userPosts);
