/**
 * Maximum file upload size in bytes per plan.
 * Used by UploadSection and BatchUploadSection to enforce plan-based limits.
 */
export const PLAN_UPLOAD_LIMITS: Record<string, number> = {
  free: 2 * 1024 * 1024 * 1024,
  studio: 2 * 1024 * 1024 * 1024,
  scale: 2 * 1024 * 1024 * 1024,
  enterprise: 2 * 1024 * 1024 * 1024,
};
