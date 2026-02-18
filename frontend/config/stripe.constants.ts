const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === "production";

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

// Keep in sync with backend PLAN_LIMITS in backend/src/config/stripe.config.ts
export const PLAN_DETAILS = {
  free: { name: "Free", clips: 15, price: 0 },
  creator: { name: "Creator", clips: 75, price: 29925 },
  studio: { name: "Studio", clips: 400, price: 1500 },
  scale: { name: "Scale", clips: 1000, price: 2990 },
} as const;
