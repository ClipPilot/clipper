"use client";

import { Button } from "@heroui/react";
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
    <div className={`rounded-xl bg-gradient-to-br ${gradientClasses} border ${borderClass} overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl ${iconBgClass} flex items-center justify-center`}>
              <Icon icon="solar:stars-bold-duotone" className={iconTextClass} width={28} />
            </div>
            <div>
              <p className="text-lg font-bold text-text-primary">
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
 isDisabled={isDisabled || isGenerating}
 >
            {isGenerating ? (
              <span className="flex items-center gap-1">
                Starting
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                </span>
              </span>
            ) : (
              <>
                <Icon icon="solar:play-bold" width={20} />
                Generate Video
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
