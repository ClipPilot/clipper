"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { platformIcon, platformIconColor, platformDisplayName } from "@/lib/platformUtils";
import type { MassPostingAccount } from "@/types/massPosting";

interface AccountGridCardProps {
  account: MassPostingAccount;
}

export function AccountGridCard({ account }: AccountGridCardProps) {
  return (
    <Card className="bg-surface-base border border-border-base hover:border-border-base/80 transition-all cursor-pointer">
      <CardBody className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center flex-shrink-0">
            <Icon
              icon={platformIcon(account.platform)}
              width={16}
              className={platformIconColor(account.platform)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary truncate">
              {account.handle}
            </p>
            <p className="text-xs text-text-tertiary">
              {platformDisplayName(account.platform)}
            </p>
          </div>
        </div>

        <div className="border-t border-border-base my-3" />

        <div>
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">
            TOTAL REPOSTS
          </p>
          <p className="text-2xl font-bold text-accent-400 mt-0.5">
            {account.totalReposts.toLocaleString()}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
