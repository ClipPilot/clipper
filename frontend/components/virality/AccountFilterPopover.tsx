"use client";

import { useState, useMemo } from "react";
import { Button, Popover, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ViralityAccount } from "@/api/virality";

const PLATFORM_ICONS: Record<string, { icon: string; color: string }> = {
  instagram: { icon: "ri:instagram-fill", color: "text-pink-500" },
  tiktok: { icon: "ri:tiktok-fill", color: "text-cyan-500" },
  x: { icon: "ri:twitter-x-fill", color: "text-foreground" },
};

interface AccountFilterPopoverProps {
  accounts: ViralityAccount[];
  selectedAccountIds: number[];
  onChange: (ids: number[]) => void;
}

export function AccountFilterPopover({
  accounts,
  selectedAccountIds,
  onChange,
}: AccountFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<number[]>(selectedAccountIds);

  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.username.toLowerCase().includes(q) ||
        a.display_name?.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const isActive = selectedAccountIds.length > 0;

  const handleOpen = (open: boolean) => {
    if (open) {
      setPending(selectedAccountIds);
      setSearch("");
    }
    setIsOpen(open);
  };

  const toggleAccount = (id: number) => {
    setPending((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleApply = () => {
    onChange(pending);
    setIsOpen(false);
  };

  const handleClearAll = () => {
    setPending([]);
  };

  const handleSelectAll = () => {
    setPending(accounts.map((a) => a.id));
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={handleOpen}>
      <Popover.Trigger>
        <Button
 variant="tertiary"
 className={
 isActive
 ? "bg-accent-400/10 text-accent-400 border-2 border-accent-400/50"
 : "bg-surface-base text-text-primary border-2 border-border-base hover:border-accent-400/40 transition-colors"
 }
 >
          <Icon icon="solar:filter-bold" width={16} />
          Filter Accounts
          {isActive ? (
              <span className="ml-1 flex items-center justify-center min-w-[20px] h-5 rounded-full bg-accent-400 text-white text-xs font-semibold px-1.5">
                {selectedAccountIds.length}
              </span>
            ) : null}
</Button>
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="w-72 p-0 bg-white/[0.04]">
        <div className="p-3 space-y-3">
          <div className="relative">
            <Icon icon="solar:magnifer-linear" width={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            <Input onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts..." value={search} className="pl-9" />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {filteredAccounts.length === 0 ? (
              <p className="text-text-tertiary text-xs text-center py-4">No accounts found</p>
            ) : (
              filteredAccounts.map((account) => {
                const selected = pending.includes(account.id);
                const platform = PLATFORM_ICONS[account.platform] ?? PLATFORM_ICONS.instagram;
                return (
                  <div
                    key={account.id}
                    onClick={() => toggleAccount(account.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      selected
                        ? "bg-accent-400/10"
                        : "hover:bg-surface-base"
                    }`}
                  >
                    <Icon icon={platform.icon} width={16} className={platform.color} />
                    <span className="flex-1 text-sm text-text-primary truncate">
                      @{account.username}
                    </span>
                    {selected && (
                      <Icon icon="solar:check-circle-bold" width={18} className="text-accent-400 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-base">
            <div className="flex items-center gap-1">
              <Button
 size="sm"
 variant="tertiary"
 className="text-text-secondary"
 onPress={handleSelectAll}
 >
                All
              </Button>
              <Button
 size="sm"
 variant="tertiary"
 className="text-text-secondary"
 onPress={handleClearAll}
 >
                None
              </Button>
            </div>
            <Button
 size="sm"
 className="bg-accent-400 text-white"
 onPress={handleApply}
 >
              Apply
            </Button>
          </div>
        </div>
      </Popover.Content>
    </Popover>
  );
}
