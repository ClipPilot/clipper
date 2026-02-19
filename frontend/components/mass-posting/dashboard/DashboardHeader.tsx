"use client";

import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

export function DashboardHeader() {
  const router = useRouter();

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent-400/10 border border-accent-400/20">
        <Icon icon="solar:rocket-bold-duotone" width={20} className="text-accent-400 flex-shrink-0" />
        <p className="text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">Automated posting</span> is coming end of February.
        </p>
      </div>
      <div className="flex items-center justify-between">
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
        onPress={() => router.push("/dashboard/publish-posts")}
      >
        New Post
      </Button>
      </div>
    </div>
  );
}
