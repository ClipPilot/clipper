"use client";

import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

/**
 * Full-screen upgrade paywall shown to teams that don't have access
 * to the Virality Tracker feature.
 */
export function ViralityUpgradeWall() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 max-w-sm">
        <div className="relative">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-purple-500/10">
            <Icon icon="solar:chart-bold-duotone" className="text-purple-500" width={40} />
          </div>
          <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full bg-surface-dark border-2 border-surface-dark">
            <Icon icon="solar:lock-keyhole-bold" className="text-text-tertiary" width={14} />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-text-primary">Virality Tracker</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Track competitor performance, monitor viral trends, and benchmark your content against the competition.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 w-full">
          <Button
 size="lg"
 className="w-full bg-purple-500 text-white font-semibold"
 onPress={() => router.push("/dashboard/pricing")}
 >
            <Icon icon="solar:rocket-bold" width={18} />
            Upgrade to Studio
          </Button>
          <p className="text-xs text-text-tertiary">
            Available on Studio, Scale & Enterprise
          </p>
        </div>
      </div>
    </div>
  );
}
