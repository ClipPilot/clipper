"use client";

import React from "react";
import { Button, Chip, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { IntakeFormData } from "@/api/intake";
import { SOCIAL_PLATFORMS, getActiveTier } from "@/constants/massPosting";

interface StepReviewProps {
  data: IntakeFormData;
  isAppeal: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function StepReview({ data, isAppeal, isSubmitting, onSubmit }: StepReviewProps) {
  const activeTier = data.budget ? getActiveTier(data.budget) : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          Review Your Application
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          Please review the information below before submitting.
        </p>
      </div>

      {/* Campaign & Brand Info */}
      <ReviewSection title="Campaign & Brand Info" icon="solar:buildings-bold-duotone">
        <ReviewField label="Campaign Name" value={data.name} />
        <ReviewField label="Description" value={data.brand_description} />
        <ReviewField label="Website" value={data.company_website_url} />
      </ReviewSection>

      {/* Socials */}
      <ReviewSection title="Social Accounts" icon="solar:share-circle-bold-duotone">
        {data.company_socials?.map((s, i) => (
          <ReviewField
            key={i}
            label={SOCIAL_PLATFORMS.find((p) => p.key === s.platform)?.label ?? s.platform}
            value={s.url}
          />
        ))}
      </ReviewSection>

      {/* Competitors */}
      {data.competitor_socials && data.competitor_socials.length > 0 && (
        <ReviewSection title="Competitors" icon="solar:users-group-two-rounded-bold-duotone">
          {data.competitor_socials.map((c, i) => (
            <div key={i} className="mb-3 last:mb-0">
              <p className="text-sm font-medium text-text-primary">
                {c.companyName || "Unnamed"}
              </p>
              {c.accounts.map((a, j) => (
                <p key={j} className="text-sm text-text-secondary pl-3">
                  {a.platform}: {a.url || "\u2014"}
                </p>
              ))}
            </div>
          ))}
        </ReviewSection>
      )}

      {/* ICPs */}
      <ReviewSection title="Ideal Customer Profiles" icon="solar:users-group-rounded-bold-duotone">
        {data.icps?.map((icp, i) => (
          <div key={i} className="mb-4 last:mb-0">
            <p className="text-sm font-semibold text-text-primary">
              {icp.name || `ICP #${i + 1}`}
            </p>
            {icp.description && (
              <p className="text-sm text-text-secondary">{icp.description}</p>
            )}
            {icp.demographics && (
              <p className="text-xs text-text-tertiary mt-1">
                Demographics: {icp.demographics}
              </p>
            )}
            {icp.painPoints && icp.painPoints.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {icp.painPoints.map((pp, j) => (
                  <Chip key={j} size="sm" variant="flat">
                    {pp}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        ))}
      </ReviewSection>

      {/* Budget */}
      {data.budget && (
        <ReviewSection title="Budget" icon="solar:wallet-money-bold-duotone">
          <ReviewField label="Monthly Budget" value={`$${data.budget.toLocaleString()}`} />
          {activeTier && (
            <>
              <ReviewField label="CPM Tier" value={`${activeTier.label} — $${activeTier.cpm.toFixed(2)} CPM`} />
            </>
          )}
        </ReviewSection>
      )}

      <Divider />

      <Button
        fullWidth
        size="lg"
        color="primary"
        isLoading={isSubmitting}
        onPress={onSubmit}
        startContent={
          !isSubmitting && (
            <Icon
              icon={isAppeal ? "solar:pen-new-round-bold" : "solar:send-square-bold"}
            />
          )
        }
      >
        {isSubmitting
          ? "Submitting..."
          : isAppeal
            ? "Submit Appeal"
            : "Submit Application"}
      </Button>
    </div>
  );
}

// ── Shared review helpers ───────────────────────────────────────

function ReviewSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon icon={icon} className="text-lg text-accent-400" />
        <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      </div>
      <div className="pl-7 space-y-2">{children}</div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-xs text-text-tertiary">{label}</span>
      <p className="text-sm text-text-secondary">{value || "\u2014"}</p>
    </div>
  );
}
