"use client";

import React from "react";
import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import Image, { StaticImageData } from "next/image";
import CuttrLogo from "@/public/branding/cuttr_logo.png";
import UGCIllustration from "@/public/illustrations/ugc_studio.svg";
import AutopilotIllustration from "@/public/illustrations/autopilot_distribution.svg";

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
  illustration: StaticImageData;
  features: FeatureItem[];
  eta: string;
}

const comingSoonFeatures: ComingSoonFeature[] = [
  {
    id: "ugc",
    title: "UGC Studio",
    subtitle: "AI-Powered Content Creation",
    description:
      "Create authentic user-generated content at scale. Cuttr will handle face generation, lip-syncing, and voice cloning. No large UGC team required.",
    icon: "solar:users-group-rounded-bold",
    illustration: UGCIllustration,
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
      "End manual posting across platforms. Cuttr Autopilot schedules and distributes your clips to all connected accounts. Your brand will get access to hundreds of ready-made social media accounts, posting only your content, managed by our team. AI-optimized posting times and platform-specific formatting maximize your reach.",
    icon: "solar:global-bold",
    illustration: AutopilotIllustration,
    features: [
      {
        icon: "solar:share-bold",
        title: "Multi-Platform Publishing",
        description:
          "Connect TikTok, Instagram, YouTube Shorts, X. Post everywhere with one click.",
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
    eta: "Q1-Q2 2026",
  },
];

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
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
          <h1 className="text-3xl lg:text-4xl font-bold text-text-primary">
            What&apos;s Next
          </h1>
          <p className="text-text-secondary max-w-2xl mx-auto text-base">
            Follow our roadmap as we build the future of content creation and
            distribution.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Timeline line - hidden on mobile, shown on desktop */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent-500 via-accent-400 to-accent-300 -translate-x-1/2" />

          <div className="space-y-16 lg:space-y-24">
            {comingSoonFeatures.map((feature, index) => {
              const isEven = index % 2 === 0;

              return (
                <div key={feature.id} className="relative">
                  {/* Timeline dot */}
                  <div className="hidden lg:flex absolute left-1/2 top-8 -translate-x-1/2 w-16 h-16 rounded-full bg-surface-dark border-4 border-accent-500 items-center justify-center z-10">
                    <Icon
                      icon={feature.icon}
                      className="text-accent-400"
                      width={28}
                    />
                  </div>

                  {/* Content */}
                  <div
                    className={`lg:grid lg:grid-cols-2 lg:gap-16 ${
                      isEven ? "" : "lg:flex-row-reverse"
                    }`}
                  >
                    {/* Left/Right content area */}
                    <div
                      className={`${
                        isEven ? "lg:col-start-1" : "lg:col-start-2"
                      }`}
                    >
                      <Card className="bg-surface-base border border-border-base hover:border-accent-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent-500/10">
                        <CardBody className="p-6 lg:p-8">
                          {/* Header with ETA */}
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="lg:hidden w-12 h-12 rounded-xl bg-surface-elevated border border-border-base flex items-center justify-center flex-shrink-0">
                                <Icon
                                  icon={feature.icon}
                                  className="text-text-primary"
                                  width={24}
                                />
                              </div>
                              <div>
                                <h2 className="text-xl lg:text-2xl font-bold text-text-primary">
                                  {feature.title}
                                </h2>
                                <p className="text-sm text-accent-400 font-medium mt-1">
                                  {feature.subtitle}
                                </p>
                              </div>
                            </div>
                            <Chip
                              size="sm"
                              variant="flat"
                              classNames={{
                                base: "bg-accent-500/10 border border-accent-500/30",
                                content:
                                  "text-accent-400 font-semibold text-xs",
                              }}
                            >
                              {feature.eta}
                            </Chip>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-text-secondary leading-relaxed mb-6">
                            {feature.description}
                          </p>

                          {/* Features grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {feature.features.map((item, itemIndex) => (
                              <div
                                key={itemIndex}
                                className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated/50 border border-border-base/50 hover:border-accent-500/30 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center flex-shrink-0">
                                  <Icon
                                    icon={item.icon}
                                    className="text-accent-400"
                                    width={16}
                                  />
                                </div>
                                <div>
                                  <h3 className="text-sm font-semibold text-text-primary">
                                    {item.title}
                                  </h3>
                                  <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardBody>
                      </Card>
                    </div>

                    {/* Illustration on opposite side */}
                    <div
                      className={`hidden lg:flex items-center justify-center ${
                        isEven ? "lg:col-start-2" : "lg:col-start-1 lg:row-start-1"
                      }`}
                    >
                      <div className="relative w-full max-w-lg p-12">
                        <div className="absolute inset-8 bg-gradient-to-br from-accent-500/30 to-accent-300/20 rounded-full blur-3xl" />
                        <div className="relative">
                          <Image
                            src={feature.illustration}
                            alt={`${feature.title} illustration`}
                            width={480}
                            height={480}
                            className="object-contain opacity-90 drop-shadow-2xl"
                            unoptimized
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* End of timeline marker */}
          <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 mt-8 w-12 h-12 rounded-full bg-gradient-to-br from-accent-500 to-accent-300 items-center justify-center">
            <Icon
              icon="solar:stars-bold"
              className="text-surface-dark"
              width={24}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
