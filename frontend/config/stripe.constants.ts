const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === "production";

export const STRIPE_PRICES = isProduction
  ? {
      STUDIO: "price_1SfSwWKIbKD6ydHMQNyyZ6mc",
      SCALE: "price_1SfSwWKIbKD6ydHMVRieRr2n",
      STUDIO_ADDON: "price_1SfSwXKIbKD6ydHMrRGsHTdk",
      SCALE_ADDON: "price_1SfSwXKIbKD6ydHMF5piBhSZ",
    }
  : {
      STUDIO: "price_1SfT5qGu9cYiGgY3Ji42KTKB",
      SCALE: "price_1SfT5BGu9cYiGgY33x2pCcPc",
      STUDIO_ADDON: "price_1SfTC1Gu9cYiGgY3O1P2rGc1",
      SCALE_ADDON: "price_1SfTAzGu9cYiGgY3SHUjgUf0",
    };

export const PLAN_DETAILS = {
  free: { name: "Free", clips: 3, generations: 10, price: 0 },
  studio: { name: "Studio", clips: 400, generations: -1, price: 4596 },
  scale: { name: "Scale", clips: 1000, generations: -1, price: 5990 },
} as const;
