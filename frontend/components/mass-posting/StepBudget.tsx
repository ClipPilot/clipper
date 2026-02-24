"use client";

import React from "react";
import { Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CPM_TIERS, getActiveTier } from "@/constants/massPosting";

interface StepBudgetProps {
  budget: number | null;
  setBudget: (b: number | null) => void;
}

export function StepBudget({ budget, setBudget }: StepBudgetProps) {
  const activeTier = budget !== null && budget >= 5000 ? getActiveTier(budget) : null;
  const guaranteedViews = activeTier && budget ? Math.floor(budget / activeTier.cpm) : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          Monthly Budget
        </h3>
        <p className="text-sm text-text-secondary">
          We will review your budget and profiles to determine your mass posting contract.
        </p>
      </div>

      {/* Budget Input */}
      <Input
        type="number"
        label="Monthly Budget"
        placeholder="e.g. 25000"
        startContent={<span className="text-text-tertiary text-sm">$</span>}
        value={budget?.toString() ?? ""}
        onValueChange={(v) => setBudget(v ? parseFloat(v) : null)}
        min={0}
        step={500}
        description="Minimum $5,000 required"
        isRequired
      />

      {/* CPM Tier Cards */}
      <div className="grid grid-cols-2 gap-3">
        {CPM_TIERS.map((tier) => {
          const isActive = activeTier?.label === tier.label;

          return (
            <div
              key={tier.label}
              className={`p-4 rounded-xl border transition-colors ${
                isActive
                  ? "border-accent-400 bg-accent-400/10"
                  : "border-border-base bg-surface-elevated"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isActive ? "text-accent-400" : "text-text-tertiary"}`}>
                  {tier.label}
                </span>
                {isActive && (
                  <Icon icon="solar:check-circle-bold" className="text-accent-400 text-base" />
                )}
              </div>

              <p className={`text-lg font-bold mb-0.5 ${isActive ? "text-accent-400" : "text-text-primary"}`}>
                ${tier.cpm.toFixed(2)} <span className="text-sm font-normal">CPM</span>
              </p>

              <p className="text-xs text-text-tertiary mb-2">{tier.budgetRange}</p>

              {isActive && guaranteedViews && (
                <div className="text-xs text-accent-400/80">
                  <span className="font-semibold">{guaranteedViews.toLocaleString()} views</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* No-tier warning */}
      {budget !== null && budget > 0 && budget < 5000 && (
        <p className="text-xs text-warning-500 flex items-center gap-1.5">
          <Icon icon="solar:danger-triangle-bold-duotone" className="text-base flex-shrink-0" />
          Minimum budget of $5,000 required to qualify for a CPM tier.
        </p>
      )}
    </div>
  );
}
