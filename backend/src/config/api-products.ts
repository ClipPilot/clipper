export interface ApiProduct {
  slug: string;
  name: string;
  priceCents: number;
  unit: string;
}

export const API_PRODUCTS: Record<string, ApiProduct> = {
  clip_save: {
    slug: "clip_save",
    name: "AI Clipping",
    priceCents: 150,
    unit: "clip",
  },
  face_swap: {
    slug: "face_swap",
    name: "Face Swap",
    priceCents: 20,
    unit: "second",
  },
  // TODO LATER: ad_clone, ai_ugc
};
