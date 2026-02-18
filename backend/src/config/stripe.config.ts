import Stripe from "stripe";
import { ENV } from "./env";

export const stripe = new Stripe(ENV.STRIPE_SECRET_KEY!);

const isProduction = process.env.NODE_ENV === "production";

export const STRIPE_PRICES = isProduction
  ? {
      CREATOR: "price_1T1tVcKIbKD6ydHM4lOfIWvu",
      STUDIO: "price_1T1tUxKIbKD6ydHMU3zKPvqb",
      SCALE: "price_1T1tUYKIbKD6ydHMN5VtdtMi",
      STUDIO_ADDON: "price_1SfSwXKIbKD6ydHMrRGsHTdk",
      SCALE_ADDON: "price_1SfSwXKIbKD6ydHMF5piBhSZ",
    }
  : {
      CREATOR: "price_1T1szJGu9cYiGgY3EAmDP1Xw",
      STUDIO: "price_1T1rg5Gu9cYiGgY3Gt44c482",
      SCALE: "price_1T1reJGu9cYiGgY3ngYj1VUi",
      STUDIO_ADDON: "price_1SfTC1Gu9cYiGgY3O1P2rGc1",
      SCALE_ADDON: "price_1SfTAzGu9cYiGgY3SHUjgUf0",
    };

export const ENTERPRISE_PRODUCT = isProduction
  ? "prod_TipHjIJw7ibIIw"
  : "prod_TipICPrW7FcHcY";

export const PLAN_LIMITS = {
  FREE: { clips: 15, generations: 10, seats: 1, maxUploadSizeGB: 2 },
  CREATOR: { clips: 75, generations: -1, seats: 1, maxUploadSizeGB: 2 },
  STUDIO: { clips: 400, generations: -1, seats: 1, maxUploadSizeGB: 2 },
  SCALE: { clips: 1000, generations: -1, seats: -1, maxUploadSizeGB: 3 },
  ENTERPRISE: { clips: -1, generations: -1, seats: -1, maxUploadSizeGB: 3 },
  STUDIO_ADDON: { clips: 50 },
  SCALE_ADDON: { clips: 100 },
} as const;

export const getMaxUploadSizeForPlan = (plan: string): number => {
  switch (plan) {
    case "scale":
      return PLAN_LIMITS.SCALE.maxUploadSizeGB * 1024 * 1024 * 1024;
    case "enterprise":
      return PLAN_LIMITS.ENTERPRISE.maxUploadSizeGB * 1024 * 1024 * 1024;
    case "studio":
      return PLAN_LIMITS.STUDIO.maxUploadSizeGB * 1024 * 1024 * 1024;
    case "creator":
      return PLAN_LIMITS.CREATOR.maxUploadSizeGB * 1024 * 1024 * 1024;
    default:
      return PLAN_LIMITS.FREE.maxUploadSizeGB * 1024 * 1024 * 1024;
  }
};

export const getPlanFromPriceId = (priceId: string): string => {
  switch (priceId) {
    case STRIPE_PRICES.CREATOR:
      return "creator";
    case STRIPE_PRICES.STUDIO:
      return "studio";
    case STRIPE_PRICES.SCALE:
      return "scale";
    case STRIPE_PRICES.STUDIO_ADDON:
      return "studio_addon";
    case STRIPE_PRICES.SCALE_ADDON:
      return "scale_addon";
    default:
      return "free";
  }
};

export const getClipsLimitForPlan = (plan: string, customLimit?: number): number => {
  if (plan === "enterprise" && customLimit !== undefined) {
    return customLimit;
  }
  switch (plan) {
    case "creator":
      return PLAN_LIMITS.CREATOR.clips;
    case "studio":
      return PLAN_LIMITS.STUDIO.clips;
    case "scale":
      return PLAN_LIMITS.SCALE.clips;
    case "enterprise":
      return PLAN_LIMITS.ENTERPRISE.clips;
    default:
      return PLAN_LIMITS.FREE.clips;
  }
};

export const isAddonPrice = (priceId: string): boolean => {
  return (
    priceId === STRIPE_PRICES.STUDIO_ADDON ||
    priceId === STRIPE_PRICES.SCALE_ADDON
  );
};

export const getAddonClips = (priceId: string): number => {
  switch (priceId) {
    case STRIPE_PRICES.STUDIO_ADDON:
      return PLAN_LIMITS.STUDIO_ADDON.clips;
    case STRIPE_PRICES.SCALE_ADDON:
      return PLAN_LIMITS.SCALE_ADDON.clips;
    default:
      return 0;
  }
};
