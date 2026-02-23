"use client";

import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface PlanUpgradeWallProps {
  title: string;
  description: string;
  icon: string;
  buttonLabel?: string;
}

/**
 * Full-screen locked-feature gate shown when the current plan
 * does not include the requested feature.
 *
 * Usage:
 *   <PlanUpgradeWall
 *     title="Publish Posts"
 *     description="Send clips to social platforms. Available on Studio plan and above."
 *     icon="solar:posts-carousel-vertical-bold-duotone"
 *   />
 */
export function PlanUpgradeWall({
  title,
  description,
  icon,
  buttonLabel = "Upgrade to Studio",
}: PlanUpgradeWallProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 max-w-sm">
        <div className="relative">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-accent-400/10">
            <Icon icon={icon} className="text-accent-400" width={40} />
          </div>
          <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full bg-surface-dark border-2 border-surface-dark">
            <Icon
              icon="solar:lock-keyhole-bold"
              className="text-text-tertiary"
              width={14}
            />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {description}
          </p>
        </div>
        <Button
          size="lg"
          className="w-full bg-accent-400 text-white font-semibold"
          onPress={() => router.push("/dashboard/pricing")}
          startContent={<Icon icon="solar:rocket-bold" width={18} />}
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
