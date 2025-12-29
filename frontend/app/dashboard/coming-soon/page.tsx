"use client";

import React from "react";
import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import Image from "next/image";
import CuttrLogo from "@/public/branding/cuttr_logo.png";

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

interface ComingSoonFeature {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  features: FeatureItem[];
  eta: string;
}

const comingSoonFeatures: ComingSoonFeature[] = [
  {
    id: "ugc",
    title: "UGC Studio",
    subtitle: "AI-Powered Content Creation",
    description:
      "Create authentic user-generated content at scale. Our AI handles face generation, lip-syncing, and voice cloning—no actors or shoots required. Professional UGC, accessible to every creator and brand.",
    icon: "solar:users-group-rounded-bold",
    features: [
      {
        icon: "solar:user-id-bold",
        title: "AI Face Swap",
        description:
          "Swap faces in your videos with realistic AI. Create diverse UGC content while maintaining brand consistency.",
      },
      {
        icon: "solar:user-circle-bold",
        title: "AI Avatar Generation",
        description:
          "Generate photorealistic avatars to present your content. Hundreds of diverse faces, ages, and styles available.",
      },
      {
        icon: "solar:microphone-bold",
        title: "Voice Cloning & Lip Sync",
        description:
          "Clone voices and sync lips to any audio. Create multilingual content without re-recording.",
      },
      {
        icon: "solar:document-text-bold",
        title: "Script to Video",
        description:
          "Turn scripts into fully produced UGC videos. Write your message, we handle production.",
      },
    ],
    eta: "Q1 2026",
  },
  {
    id: "autopilot",
    title: "Autopilot Distribution",
    subtitle: "Automated Multi-Platform Posting",
    description:
      "End manual posting across platforms. Cuttr Autopilot schedules and distributes your clips to all connected accounts. AI-optimized posting times and platform-specific formatting maximize your reach.",
    icon: "solar:global-bold",
    features: [
      {
        icon: "solar:share-bold",
        title: "Multi-Platform Publishing",
        description:
          "Connect TikTok, Instagram, YouTube Shorts, X, LinkedIn. Post everywhere with one click.",
      },
      {
        icon: "solar:calendar-mark-bold",
        title: "Smart Scheduling",
        description:
          "AI analyzes engagement patterns to find optimal posting times for maximum visibility.",
      },
      {
        icon: "solar:graph-up-bold",
        title: "Cross-Platform Analytics",
        description:
          "Unified dashboard showing performance across all platforms. Understand what works where.",
      },
      {
        icon: "solar:refresh-bold",
        title: "Auto-Repurposing",
        description:
          "Automatically adapt aspect ratios and captions for each platform. One clip, optimized everywhere.",
      },
    ],
    eta: "Q2 2026",
  },
];

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Image
              src={CuttrLogo}
              alt="Cuttr"
              width={120}
              height={34}
              className="object-contain"
              unoptimized
            />
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">
            What&apos;s Next
          </h1>
          <p className="text-text-secondary max-w-xl mx-auto text-sm">
            New capabilities coming to the platform. Here&apos;s what we&apos;re building.
          </p>
        </div>

        <div className="space-y-6">
          {comingSoonFeatures.map((feature) => (
            <Card
              key={feature.id}
              className="bg-surface-base border border-border-base"
            >
              <CardBody className="p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-xl bg-surface-elevated border border-border-base flex items-center justify-center">
                      <Icon
                        icon={feature.icon}
                        className="text-text-primary"
                        width={28}
                      />
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold text-text-primary">
                        {feature.title}
                      </h2>
                      <Chip
                        size="sm"
                        variant="flat"
                        classNames={{
                          base: "bg-surface-elevated border border-border-base",
                          content: "text-text-tertiary font-medium text-xs",
                        }}
                      >
                        {feature.eta}
                      </Chip>
                    </div>
                    <p className="text-sm text-accent-400 font-medium">
                      {feature.subtitle}
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {feature.description}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                      {feature.features.map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="flex items-start gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center flex-shrink-0">
                            <Icon
                              icon={item.icon}
                              className="text-text-secondary"
                              width={16}
                            />
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-text-primary">
                              {item.title}
                            </h3>
                            <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

      </div>
    </div>
  );
}
