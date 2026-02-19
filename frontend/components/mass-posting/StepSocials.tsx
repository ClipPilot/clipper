"use client";

import {
  Button,
  Card,
  CardBody,
  Divider,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { CompanySocial, CompetitorSocial } from "@/types/massPosting";
import { SOCIAL_PLATFORMS, emptySocial, emptyCompetitor } from "@/constants/massPosting";

interface StepSocialsProps {
  companySocials: CompanySocial[];
  setCompanySocials: (v: CompanySocial[]) => void;
  competitorSocials: CompetitorSocial[];
  setCompetitorSocials: (v: CompetitorSocial[]) => void;
}

export function StepSocials({
  companySocials,
  setCompanySocials,
  competitorSocials,
  setCompetitorSocials,
}: StepSocialsProps) {
  // ── Company socials ──
  const addCompanySocial = () =>
    setCompanySocials([...companySocials, emptySocial()]);

  const removeCompanySocial = (idx: number) =>
    setCompanySocials(companySocials.filter((_: CompanySocial, i: number) => i !== idx));

  const updateCompanySocial = (idx: number, field: string, value: string) => {
    const updated = [...companySocials];
    updated[idx] = { ...updated[idx], [field]: value };
    setCompanySocials(updated);
  };

  // ── Competitor socials ──
  const addCompetitor = () =>
    setCompetitorSocials([...competitorSocials, emptyCompetitor()]);

  const removeCompetitor = (idx: number) =>
    setCompetitorSocials(competitorSocials.filter((_: CompetitorSocial, i: number) => i !== idx));

  const updateCompetitorField = (idx: number, field: string, value: string) => {
    const updated = [...competitorSocials];
    updated[idx] = { ...updated[idx], [field]: value };
    setCompetitorSocials(updated);
  };

  const addCompetitorAccount = (competitorIdx: number) => {
    const updated = [...competitorSocials];
    updated[competitorIdx] = {
      ...updated[competitorIdx],
      accounts: [
        ...updated[competitorIdx].accounts,
        { platform: "instagram", url: "" },
      ],
    };
    setCompetitorSocials(updated);
  };

  const updateCompetitorAccount = (
    competitorIdx: number,
    accountIdx: number,
    field: string,
    value: string
  ) => {
    const updated = [...competitorSocials];
    const accounts = [...updated[competitorIdx].accounts];
    accounts[accountIdx] = { ...accounts[accountIdx], [field]: value };
    updated[competitorIdx] = { ...updated[competitorIdx], accounts };
    setCompetitorSocials(updated);
  };

  const removeCompetitorAccount = (competitorIdx: number, accountIdx: number) => {
    const updated = [...competitorSocials];
    updated[competitorIdx] = {
      ...updated[competitorIdx],
      accounts: updated[competitorIdx].accounts.filter(
        (_: { platform: string; url: string }, i: number) => i !== accountIdx
      ),
    };
    setCompetitorSocials(updated);
  };

  return (
    <div className="space-y-8">
      {/* Company Socials */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          Your Social Accounts
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          Add the social media accounts associated with your brand.
        </p>
        <div className="space-y-3">
          {companySocials.map((social, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <Select
                className="w-40 flex-shrink-0"
                size="sm"
                selectedKeys={[social.platform]}
                onChange={(e) => updateCompanySocial(idx, "platform", e.target.value)}
                aria-label="Platform"
              >
                {SOCIAL_PLATFORMS.map((p) => (
                  <SelectItem key={p.key}>{p.label}</SelectItem>
                ))}
              </Select>
              <Input
                size="sm"
                placeholder="https://instagram.com/yourbrand"
                value={social.url}
                onValueChange={(v) => updateCompanySocial(idx, "url", v)}
                className="flex-1"
              />
              {companySocials.length > 1 && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => removeCompanySocial(idx)}
                >
                  <Icon icon="solar:trash-bin-trash-bold" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="flat"
          className="mt-3"
          onPress={addCompanySocial}
          startContent={<Icon icon="solar:add-circle-bold" />}
        >
          Add Account
        </Button>
      </div>

      <Divider />

      {/* Competitor Socials */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          Competitor Accounts
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          Add competitors whose style or audience you'd like to reference.
        </p>
        <div className="space-y-6">
          {competitorSocials.map((competitor, cIdx) => (
            <Card key={cIdx} className="bg-surface-elevated border border-border-base">
              <CardBody className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    size="sm"
                    label="Competitor Name"
                    placeholder="e.g. Acme Corp"
                    value={competitor.companyName}
                    onValueChange={(v) => updateCompetitorField(cIdx, "companyName", v)}
                    className="flex-1"
                  />
                  {competitorSocials.length > 1 && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => removeCompetitor(cIdx)}
                    >
                      <Icon icon="solar:trash-bin-trash-bold" />
                    </Button>
                  )}
                </div>
                {competitor.accounts.map((account, aIdx) => (
                  <div key={aIdx} className="flex items-start gap-2 pl-2">
                    <Select
                      className="w-36 flex-shrink-0"
                      size="sm"
                      selectedKeys={[account.platform]}
                      onChange={(e) =>
                        updateCompetitorAccount(cIdx, aIdx, "platform", e.target.value)
                      }
                      aria-label="Platform"
                    >
                      {SOCIAL_PLATFORMS.map((p) => (
                        <SelectItem key={p.key}>{p.label}</SelectItem>
                      ))}
                    </Select>
                    <Input
                      size="sm"
                      placeholder="Account URL"
                      value={account.url}
                      onValueChange={(v) => updateCompetitorAccount(cIdx, aIdx, "url", v)}
                      className="flex-1"
                    />
                    {competitor.accounts.length > 1 && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => removeCompetitorAccount(cIdx, aIdx)}
                      >
                        <Icon icon="solar:trash-bin-trash-bold" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => addCompetitorAccount(cIdx)}
                  startContent={<Icon icon="solar:add-circle-linear" />}
                >
                  Add Account
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
        <Button
          size="sm"
          variant="flat"
          className="mt-3"
          onPress={addCompetitor}
          startContent={<Icon icon="solar:add-circle-bold" />}
        >
          Add Competitor
        </Button>
      </div>
    </div>
  );
}
