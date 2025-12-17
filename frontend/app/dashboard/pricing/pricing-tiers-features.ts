import type { PricingFeatures } from "./pricing-comparison-types";
import { TiersEnum } from "./pricing-types";

const features: PricingFeatures = [
  {
    title: "Generation & Clips",
    items: [
      {
        title: "AI clip generations",
        tiers: {
          [TiersEnum.Free]: "3 total",
          [TiersEnum.Studio]: "Unlimited",
          [TiersEnum.Scale]: "Unlimited",
        },
        helpText:
          "Generate AI-powered clips from your videos. Generated clips have watermarks until saved.",
      },
      {
        title: "Saved clips included",
        tiers: {
          [TiersEnum.Free]: "3 included",
          [TiersEnum.Studio]: "400/month",
          [TiersEnum.Scale]: "1,000/month",
        },
        helpText: "Save and download your favorite clips without watermarks.",
      },
      {
        title: "Clip storage duration",
        tiers: {
          [TiersEnum.Free]: "30 days",
          [TiersEnum.Studio]: "1 year",
          [TiersEnum.Scale]: "Unlimited",
        },
        helpText: "How long your saved clips are stored in your account.",
      },
    ],
  },
  {
    title: "Export & Quality",
    items: [
      {
        title: "Watermark-free exports",
        tiers: {
          [TiersEnum.Free]: false,
          [TiersEnum.Studio]: true,
          [TiersEnum.Scale]: true,
        },
        helpText: "Export clips without any watermarks or branding.",
      },
      {
        title: "Multiple export formats",
        tiers: {
          [TiersEnum.Free]: "MP4 only",
          [TiersEnum.Studio]: "MP4, MOV, WebM",
          [TiersEnum.Scale]: "All formats",
        },
        helpText: "Available file formats for exporting your clips.",
      },
      {
        title: "Batch export",
        tiers: {
          [TiersEnum.Free]: false,
          [TiersEnum.Studio]: true,
          [TiersEnum.Scale]: true,
        },
        helpText: "Export multiple clips at once to save time.",
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
          [TiersEnum.Studio]: "Advanced",
          [TiersEnum.Scale]: "Advanced",
        },
        helpText:
          "Add text, titles, and auto-generated captions to your clips.",
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
          [TiersEnum.Studio]: false,
          [TiersEnum.Scale]: "Unlimited",
        },
        helpText: "Organize your clips into folders for easy management.",
      },
      {
        title: "Custom link sharing",
        tiers: {
          [TiersEnum.Free]: false,
          [TiersEnum.Studio]: false,
          [TiersEnum.Scale]: true,
        },
        helpText: "Create custom shareable links for your clips.",
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
          [TiersEnum.Studio]: "Just you",
          [TiersEnum.Scale]: "Unlimited",
        },
        helpText: "Add team members to collaborate on clips.",
      },
      {
        title: "Role-based permissions",
        tiers: {
          [TiersEnum.Free]: false,
          [TiersEnum.Studio]: false,
          [TiersEnum.Scale]: true,
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
          [TiersEnum.Studio]: true,
          [TiersEnum.Scale]: true,
        },
        helpText: "Access to documentation and self-help resources.",
      },
      {
        title: "Email support",
        tiers: {
          [TiersEnum.Free]: "Standard",
          [TiersEnum.Studio]: "Priority",
          [TiersEnum.Scale]: "Priority",
        },
        helpText: "Get help via email from our support team.",
      },
    ],
  },
];

export default features;
