import Stripe from "stripe";
import { ENV } from "./env";

export const stripe = new Stripe(ENV.STRIPE_SECRET_KEY!);

export const STRIPE_PRICES = {
  STUDIO: "price_1SeiLyGu9cYiGgY365Gs60AW",
  SCALE: "price_1SeiLyGu9cYiGgY320k4zUWp",
  STUDIO_ADDON: "price_1SeiLzGu9cYiGgY3c734FM7S",
  SCALE_ADDON: "price_1SeiLzGu9cYiGgY3KT3zya5Z",
} as const;

export const PLAN_LIMITS = {
  FREE: { clips: 3, seats: 1 },
  STUDIO: { clips: 500, seats: 3 },
  SCALE: { clips: 1000, seats: -1 },
  STUDIO_ADDON: { clips: 50 },
  SCALE_ADDON: { clips: 100 },
} as const;

export const getPlanFromPriceId = (priceId: string): string => {
  switch (priceId) {
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

export const getClipsLimitForPlan = (plan: string): number => {
  switch (plan) {
    case "studio":
      return PLAN_LIMITS.STUDIO.clips;
    case "scale":
      return PLAN_LIMITS.SCALE.clips;
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
