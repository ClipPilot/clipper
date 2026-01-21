"use client";

import { motion } from "framer-motion";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { ScalePlanRequired } from "@/components/ugc-studio";

export default function UGCStudioPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const router = useRouter();

  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return <ScalePlanRequired currentPlan={selectedTeam?.plan || "free"} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-surface-dark"
    >
      <div className="max-w-5xl mx-auto px-6 py-12 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-400/10 border border-accent-400/20 mb-6">
            <Icon
              icon="solar:magic-stick-3-bold"
              className="text-accent-400"
              width={18}
            />
            <span className="text-accent-400 text-sm font-medium">
              AI-Powered Creation
            </span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-text-primary mb-4">
            UGC Studio
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Create professional user-generated content with AI. Transform your
            videos with character swapping or generate entirely new UGC from
            scratch.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          <FeatureCard
            icon="solar:mask-happly-bold-duotone"
            title="Character Swap"
            description="Replace faces in your existing videos with AI-generated characters. Perfect for creating UGC-style content with virtual creators."
            gradient="from-violet-500/20 via-purple-500/10 to-transparent"
            iconColor="text-violet-400"
            features={[
              "Upload any video",
              "Choose from 12+ characters",
              "Face or full body swap",
            ]}
            onPress={() => router.push("/dashboard/ugc-studio/face-swap")}
          />
          <FeatureCard
            icon="solar:videocamera-record-bold-duotone"
            title="AI Video Creator"
            description="Generate complete UGC videos from text prompts. Create talking-head videos, product demos, and testimonials with AI actors."
            gradient="from-cyan-500/20 via-blue-500/10 to-transparent"
            iconColor="text-cyan-400"
            features={[
              "Text-to-video generation",
              "Custom AI avatars",
              "Script to video",
            ]}
            onPress={() =>
              router.push("/dashboard/ugc-studio/ai-video-creator")
            }
          />
          <FeatureCard
            icon="solar:copy-bold-duotone"
            title="Ad Clone"
            description="Clone winning ads with your own product. Upload a reference ad, your product, and let AI recreate it for your brand."
            gradient="from-orange-500/20 via-amber-500/10 to-transparent"
            iconColor="text-orange-400"
            features={[
              "Clone any ad style",
              "Your product placement",
              "AI-powered recreation",
            ]}
            onPress={() => router.push("/dashboard/ugc-studio/ad-clone")}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <p className="text-text-tertiary text-sm">
            More AI creation tools coming soon
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
  iconColor,
  features,
  comingSoon,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  gradient: string;
  iconColor: string;
  features: string[];
  comingSoon?: boolean;
  onPress: () => void;
}) {
  return (
    <Card
      className={`bg-surface-base border border-border-base overflow-hidden transition-all duration-300 ${
        comingSoon
          ? "opacity-70 cursor-not-allowed"
          : "hover:border-accent-400/40 hover:shadow-lg hover:shadow-accent-400/5 cursor-pointer group"
      }`}
      isPressable={!comingSoon}
      onPress={onPress}
    >
      <CardBody className="p-0">
        <div
          className={`h-32 bg-gradient-to-br ${gradient} relative flex items-center justify-center`}
        >
          <div
            className={`w-20 h-20 rounded-2xl bg-surface-base/80 backdrop-blur flex items-center justify-center ${!comingSoon && "group-hover:scale-110"} transition-transform duration-300`}
          >
            <Icon
              icon={icon}
              className={comingSoon ? "text-text-tertiary" : iconColor}
              width={44}
            />
          </div>
          {comingSoon && (
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-surface-base/90 backdrop-blur border border-border-subtle">
              <span className="text-xs font-medium text-text-secondary">
                Coming Soon
              </span>
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3
              className={`text-xl font-semibold mb-2 ${comingSoon ? "text-text-tertiary" : "text-text-primary"}`}
            >
              {title}
            </h3>
            <p
              className={`text-sm leading-relaxed ${comingSoon ? "text-text-muted" : "text-text-secondary"}`}
            >
              {description}
            </p>
          </div>

          <div className="space-y-2">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <Icon
                  icon="solar:check-circle-bold"
                  className={comingSoon ? "text-text-muted" : "text-green-400"}
                  width={16}
                />
                <span
                  className={`text-sm ${comingSoon ? "text-text-muted" : "text-text-secondary"}`}
                >
                  {feature}
                </span>
              </div>
            ))}
          </div>

          {!comingSoon && (
            <div className="pt-2 flex items-center gap-2 text-accent-400 text-sm font-medium">
              <span>Get Started</span>
              <Icon
                icon="solar:arrow-right-linear"
                width={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
