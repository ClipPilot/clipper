import type { PricingFeatures } from "./pricing-comparison-types";
import { TiersEnum } from "./pricing-types";

const features: PricingFeatures = [
  {
    title: "Generation & Clips",
    items: [
      {
        title: "AI clip generations",
        tiers: {
          [TiersEnum.Free]: "10 total",
          [TiersEnum.Creator]: "Unlimited",
          [TiersEnum.Studio]: "Unlimited",
          [TiersEnum.Scale]: "Unlimited",
          [TiersEnum.Enterprise]: "Unlimited",
        },
        helpText: "Generate AI-powered clips from your videos.",
      },
      {
        title: "Credits",
        tiers: {
          [TiersEnum.Free]: "15 credits included",
          [TiersEnum.Creator]: "75 credits / month",
          [TiersEnum.Studio]: "400 credits / month",
          [TiersEnum.Scale]: "1,000 credits / month",
          [TiersEnum.Enterprise]: "Custom credits",
        },
        helpText: "Use credits to save and download your favorite clips.",
      },
    ],
  },
  {
    title: "Editing Features",
    items: [
      {
        title: "Account Heading & captions",
        tiers: {
          [TiersEnum.Free]: "Basic",
          [TiersEnum.Creator]: "Basic",
          [TiersEnum.Studio]: "Advanced",
          [TiersEnum.Scale]: "Advanced",
          [TiersEnum.Enterprise]: "Advanced",
        },
        helpText:
          "Add text, titles, and auto-generated captions to your clips.",
      },
    ],
  },
  {
    title: "Analytics",
    items: [
      {
        title: "Mass Posting",
        tiers: {
          [TiersEnum.Free]: false,
          [TiersEnum.Creator]: false,
          [TiersEnum.Studio]: true,
          [TiersEnum.Scale]: true,
          [TiersEnum.Enterprise]: true,
        },
        helpText: "Automate posting across multiple platforms.",
      },
      {
        title: "Virality Tracker",
        tiers: {
          [TiersEnum.Free]: false,
          [TiersEnum.Creator]: false,
          [TiersEnum.Studio]: true,
          [TiersEnum.Scale]: true,
          [TiersEnum.Enterprise]: true,
        },
        helpText: "Track competitor performance and viral content trends.",
      },
    ],
  },
  {
    title: "Organization",
    items: [
      {
        title: "Folder management",
        tiers: {
          [TiersEnum.Free]: false,
          [TiersEnum.Creator]: false,
          [TiersEnum.Studio]: false,
          [TiersEnum.Scale]: "Unlimited",
          [TiersEnum.Enterprise]: "Unlimited",
        },
        helpText: "Organize your clips into folders for easy management.",
      },
      {
        title: "Clip sharing",
        tiers: {
          [TiersEnum.Free]: true,
          [TiersEnum.Creator]: true,
          [TiersEnum.Studio]: true,
          [TiersEnum.Scale]: true,
          [TiersEnum.Enterprise]: true,
        },
        helpText: "Share your clips with anyone using shareable links.",
      },
    ],
  },
  {
    title: "Team & Collaboration",
    items: [
      {
        title: "Team member seats",
        tiers: {
          [TiersEnum.Free]: "Just you",
          [TiersEnum.Creator]: "Just you",
          [TiersEnum.Studio]: "Just you",
          [TiersEnum.Scale]: "Unlimited",
          [TiersEnum.Enterprise]: "Unlimited",
        },
        helpText: "Add team members to collaborate on clips.",
      },
      {
        title: "Role-based permissions",
        tiers: {
          [TiersEnum.Free]: false,
          [TiersEnum.Creator]: false,
          [TiersEnum.Studio]: false,
          [TiersEnum.Scale]: true,
          [TiersEnum.Enterprise]: true,
        },
        helpText: "Control who can view, edit, or manage clips.",
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        title: "Help center access",
        tiers: {
          [TiersEnum.Free]: true,
          [TiersEnum.Creator]: true,
          [TiersEnum.Studio]: true,
          [TiersEnum.Scale]: true,
          [TiersEnum.Enterprise]: true,
        },
        helpText: "Access to documentation and self-help resources.",
      },
      {
        title: "Email support",
        tiers: {
          [TiersEnum.Free]: "Standard",
          [TiersEnum.Creator]: "Standard",
          [TiersEnum.Studio]: "Priority",
          [TiersEnum.Scale]: "Priority",
          [TiersEnum.Enterprise]: "Dedicated",
        },
        helpText: "Get help via email from our support team.",
      },
    ],
  },
];

export default features;
