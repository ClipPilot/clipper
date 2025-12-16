// create_flat_plans.js
// npm i stripe
// STRIPE_SECRET_KEY=sk_live_... node create_flat_plans.js

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function createProductWithPrice({
  name,
  description,
  amountCents,
  metadata,
  nickname,
}) {
  const product = await stripe.products.create({
    name,
    description,
    metadata,
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: amountCents,
    recurring: { interval: "month" },
    nickname,
  });

  return { product, price };
}

async function crateOneOffPrice({
  name,
  description,
  amountCents,
  metadata,
  nickname,
}) {
  const product = await stripe.products.create({
    name,
    description,
    metadata,
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: amountCents,
    nickname,
  });

  return { product, price };
}

async function main() {
  // ===== STUDIO =====
  const studio = await createProductWithPrice({
    name: "Studio",
    description:
      "500 saved clips/month. Up to 3 team seats. No folders. No shareable links. No analytics.",
    amountCents: 500 * 1699, // $8,495.00
    nickname: "Studio – 500 clips",
    metadata: {
      plan: "studio",
      saved_clips: "500",
      seats: "3",
      folders: "false",
      share_links: "false",
      analytics: "false",
    },
  });

  // ===== SCALE =====
  const scale = await createProductWithPrice({
    name: "Scale",
    description:
      "1000 saved clips/month. Unlimited seats & roles. Folders. Shareable links. Full analytics.",
    amountCents: 1000 * 899, // $8,990.00
    nickname: "Scale – 1000 clips",
    metadata: {
      plan: "scale",
      saved_clips: "1000",
      seats: "unlimited",
      folders: "true",
      share_links: "true",
      analytics: "true",
      activity_monitoring: "true",
    },
  });

  // ===== ADD-ONS =====

  //Stuio +50 addon
  const studioAddon = await crateOneOffPrice({
    name: "Studio Add-On: +50 Saved Clips",
    description: "Adds 50 saved clips per month.",
    amountCents: 50 * 1699, // $849.50
    nickname: "Studio +50 clips",
    metadata: {
      addon_for: "studio",
      saved_clips: "50",
    },
  });

  //Scale +100 addon --- check boht with patrik TODO
  const scaleAddon = await crateOneOffPrice({
    name: "Scale Add-On: +100 Saved Clips",
    description: "Adds 100 saved clips per month.",
    amountCents: 100 * 899, // $899.00
    nickname: "Scale +100 clips",
    metadata: {
      addon_for: "scale",
      saved_clips: "100",
    },
  });

  console.log("✅ Prices created:");
  console.log("Studio:", studio.price.id);
  console.log("Scale:", scale.price.id);
  console.log("Studio add-on:", studioAddon.price.id);
  console.log("Scale add-on:", scaleAddon.price.id);
}

main().catch(console.error);
