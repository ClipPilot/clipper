"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { WidgetWrapper } from "../WidgetWrapper";

interface QuickActionsWidgetProps {
  color?: string;
  onColorChange?: (color: string) => void;
}

const QUICK_ACTIONS = [
  {
    id: "create",
    label: "Create Clip",
    icon: "solar:scissors-bold",
    href: "/dashboard/create",
    color: "primary",
  },
  {
    id: "faceswap",
    label: "Face Swap",
    icon: "solar:face-scan-circle-bold",
    href: "/dashboard/ugc-studio/face-swap",
    color: "secondary",
  },
  {
    id: "aivideo",
    label: "AI Video",
    icon: "solar:magic-stick-3-bold",
    href: "/dashboard/ugc-studio/ai-video-creator",
    color: "success",
  },
  {
    id: "library",
    label: "Library",
    icon: "solar:folder-bold",
    href: "/dashboard/clips",
    color: "warning",
  },
];

export function QuickActionsWidget({ color, onColorChange }: QuickActionsWidgetProps) {
  const router = useRouter();

  return (
    <WidgetWrapper
      id="quickActions"
      title="Quick Actions"
      icon="solar:bolt-bold"
      color={color}
      onColorChange={onColorChange}
    >
      <div className="grid grid-cols-2 gap-2 h-full">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.id}
            variant="flat"
            color={action.color as any}
            className="flex flex-col items-center justify-center h-full min-h-[60px] gap-1"
            onPress={() => router.push(action.href)}
          >
            <Icon icon={action.icon} width={20} />
            <span className="text-xs">{action.label}</span>
          </Button>
        ))}
      </div>
    </WidgetWrapper>
  );
}
