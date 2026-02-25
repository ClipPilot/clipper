"use client";

import { Input, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";

interface StepBrandInfoProps {
  campaignName: string;
  setCampaignName: (v: string) => void;
  brandDescription: string;
  setBrandDescription: (v: string) => void;
  companyWebsite: string;
  setCompanyWebsite: (v: string) => void;
}

export function StepBrandInfo({
  campaignName,
  setCampaignName,
  brandDescription,
  setBrandDescription,
  companyWebsite,
  setCompanyWebsite,
}: StepBrandInfoProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          Campaign & Brand Information
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          Name your campaign and tell us about your brand.
        </p>
      </div>
      <Input
        label="Campaign Name"
        placeholder="e.g. Summer Launch 2026"
        value={campaignName}
        onValueChange={setCampaignName}
        isRequired
        startContent={
          <Icon icon="solar:flag-bold-duotone" className="text-text-tertiary" />
        }
      />
      <Textarea
        label="Brand Description"
        placeholder="Describe your brand, products/services, and target market..."
        value={brandDescription}
        onValueChange={setBrandDescription}
        minRows={4}
        maxRows={8}
        isRequired
      />
      <Input
        label="Company Website"
        placeholder="https://yourcompany.com"
        type="url"
        value={companyWebsite}
        onValueChange={setCompanyWebsite}
        startContent={
          <Icon icon="solar:global-bold-duotone" className="text-text-tertiary" />
        }
      />
    </div>
  );
}
