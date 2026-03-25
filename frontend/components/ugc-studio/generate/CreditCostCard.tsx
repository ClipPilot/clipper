"use client";

import { Card, Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface CreditCostCardProps {
  creditCost: number;
  creditsRemaining: number | undefined;
  isLoading: boolean;
  isDisabled: boolean;
  isGenerating?: boolean;
  onGenerate: () => void;
  gradientClasses: string;
  borderClass: string;
  iconBgClass: string;
  iconTextClass: string;
  buttonClass: string;
}

export function CreditCostCard({
  creditCost,
  creditsRemaining,
  isLoading,
  isDisabled,
  isGenerating,
  onGenerate,
  gradientClasses,
  borderClass,
  iconBgClass,
  iconTextClass,
  buttonClass,
}: CreditCostCardProps) {
  return (
    <Card className={`bg-gradient-to-br ${gradientClasses} border ${borderClass}`}>
      <Card.Content className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl ${iconBgClass} flex items-center justify-center`}>
              <Icon icon="solar:stars-bold-duotone" className={iconTextClass} width={28} />
            </div>
            <div>
              <p className="text-lg font-bold text-text-accent">
                {creditCost} Credits
              </p>
              <p className="text-sm text-text-secondary">
                Based on estimated video length
              </p>
              <p className="text-xs text-text-muted mt-1">
                {isLoading
                  ? "Loading credits..."
                  : `You have ${creditsRemaining} credits remaining`}
              </p>
            </div>
          </div>
          <Button
 size="lg"
 className={`${buttonClass} px-8`}
 onPress={onGenerate}
 isDisabled={isDisabled}
 isPending={isGenerating}
 >
            {!isGenerating ? <Icon icon="solar:play-bold" width={20} /> : undefined}
            {isGenerating ? "Starting..." : "Generate Video"}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
