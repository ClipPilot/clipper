"use client";

import { Card, CardBody, Avatar } from "@heroui/react";
import { Icon } from "@iconify/react";
import { platformIcon, platformIconColor } from "@/lib/platformUtils";
import type { MassPostingAccount } from "@/types/massPosting";

interface AccountGridCardProps {
  account: MassPostingAccount;
}

export function AccountGridCard({ account }: AccountGridCardProps) {
  return (
    <Card className="bg-surface-base border border-border-base hover:border-border-base/80 transition-all cursor-pointer">
      <CardBody className="p-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={account.avatarUrl}
            name={account.handle.charAt(1).toUpperCase()}
            size="sm"
            classNames={{ base: "bg-surface-elevated flex-shrink-0" }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-text-primary truncate">
                {account.handle}
              </p>
              <Icon
                icon={platformIcon(account.platform)}
                width={14}
                className={platformIconColor(account.platform)}
              />
            </div>
            <p className="text-xs text-text-tertiary">
              {account.platformDisplayName}
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
