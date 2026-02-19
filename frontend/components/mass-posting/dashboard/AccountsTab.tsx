"use client";

import { Icon } from "@iconify/react";

export function AccountsTab() {
  return (
    <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
      <div className="flex flex-col items-center justify-center py-24 text-text-tertiary">
        <div className="w-16 h-16 rounded-2xl bg-accent-400/10 flex items-center justify-center mb-4">
          <Icon
            icon="solar:users-group-rounded-bold-duotone"
            width={32}
            className="text-accent-400"
          />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          Accounts Coming Soon
        </h3>
        <p className="text-sm text-text-secondary max-w-sm text-center">
          Manage your connected social media accounts and track repost
          performance — all in one place.
        </p>
      </div>
    </div>
  );
}
