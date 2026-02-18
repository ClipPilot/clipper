"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#4F47E6",
    colorBackground: "#0f0f1a",
    colorText: "#e4e4e7",
    colorTextSecondary: "#71717a",
    colorDanger: "#ef4444",
    borderRadius: "8px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSizeBase: "14px",
  },
  rules: {
    ".Input": {
      border: "1px solid #27272a",
      backgroundColor: "#0f0f1a",
    },
    ".Input:focus": {
      borderColor: "#4F47E6",
    },
    ".Label": {
      fontWeight: "500",
    },
  },
};

const fonts = [
  {
    cssSrc: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap",
  },
];

export default function StripeProvider({
  clientSecret,
  children,
}: {
  clientSecret: string;
  children: React.ReactNode;
}) {
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance, fonts }}
    >
      {children}
    </Elements>
  );
}
