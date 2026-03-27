"use client";

import { Input, TextArea, TextField, Label, FieldError} from "@heroui/react";

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
      <TextField fullWidth variant="secondary" isRequired>
        <Label>Campaign Name</Label>
        <Input
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="e.g. Summer Launch 2026"
          value={campaignName}
        />
        <FieldError />
      </TextField>
      <TextField fullWidth variant="secondary" isRequired>
        <Label>Brand Description</Label>
        <TextArea
          placeholder="Describe your brand, products/services, and target market..."
          value={brandDescription}
          onChange={(e) => setBrandDescription(e.target.value)}
          rows={4}
          
        />
        <FieldError />
      </TextField>
      <TextField fullWidth variant="secondary" type="url">
        <Label>Company Website</Label>
        <Input
          onChange={(e) => setCompanyWebsite(e.target.value)}
          placeholder="https://yourcompany.com"
          value={companyWebsite}
        />
        <FieldError />
      </TextField>
    </div>
  );
}
