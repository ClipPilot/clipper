"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface DashboardHeaderProps {
  onNewPost?: () => void;
}

export function DashboardHeader({ onNewPost }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Accounts and Posts
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Manage your connected accounts and scheduled content queue.
        </p>
      </div>
      <Button
        className="bg-accent-400 text-white font-semibold"
        startContent={<Icon icon="solar:add-circle-bold" width={18} />}
        onPress={onNewPost}
      >
        New Post
      </Button>
    </div>
  );
}
