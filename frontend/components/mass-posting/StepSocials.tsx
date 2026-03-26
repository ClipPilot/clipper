"use client";

import type { Key } from "@heroui/react";
import { Button,
  Card,
  Separator,
  Input,
  Select,
  ListBox,
  TextField, Label, FieldError } from "@heroui/react";
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
          Your Social Accounts <span className="text-danger text-sm">*</span>
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          Add at least one social media account associated with your brand.
        </p>
        <div className="space-y-3">
          {companySocials.map((social, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <Select
 className="w-40 flex-shrink-0"
 value={social.platform}
 onChange={(val: Key | null) => {
 if (val) updateCompanySocial(idx, "platform", val as string);
 }}
 aria-label="Platform"
 >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {SOCIAL_PLATFORMS.map((p) => (
                      <ListBox.Item key={p.key} id={p.key} textValue={p.label}>{p.label}<ListBox.ItemIndicator /></ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Input onChange={(e) => ((v) => updateCompanySocial(idx, "url", v))(e.target.value)}
 placeholder="https://instagram.com/yourbrand"
 value={social.url}
 className="flex-1"
 />
              {companySocials.length > 1 && (
                <Button
 isIconOnly
 size="sm"
 variant="danger-soft"
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
 variant="tertiary"
 className="mt-3"
 onPress={addCompanySocial}
 >
          <Icon icon="solar:add-circle-bold" />
          Add Account
        </Button>
      </div>

      <Separator />

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
              <Card.Content className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                                    <TextField>
                    <Label>Competitor Name</Label>
                    <Input onChange={(e) => ((v) => updateCompetitorField(cIdx, "companyName", v))(e.target.value)}
 placeholder="e.g. Acme Corp"
 value={competitor.companyName}
 className="flex-1"
 />
                    <FieldError />
                  </TextField>
                  {competitorSocials.length > 1 && (
                    <Button
 isIconOnly
 size="sm"
 variant="danger-soft"
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
 value={account.platform}
 onChange={(val: Key | null) => {
 if (val) updateCompetitorAccount(cIdx, aIdx, "platform", val as string);
 }}
 aria-label="Platform"
 >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {SOCIAL_PLATFORMS.map((p) => (
                            <ListBox.Item key={p.key} id={p.key} textValue={p.label}>{p.label}<ListBox.ItemIndicator /></ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <Input onChange={(e) => ((v) => updateCompetitorAccount(cIdx, aIdx, "url", v))(e.target.value)}
 placeholder="Account URL"
 value={account.url}
 className="flex-1"
 />
                    {competitor.accounts.length > 1 && (
                      <Button
 isIconOnly
 size="sm"
 variant="danger-soft"
 onPress={() => removeCompetitorAccount(cIdx, aIdx)}
 >
                        <Icon icon="solar:trash-bin-trash-bold" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
 size="sm"
 variant="tertiary"
 onPress={() => addCompetitorAccount(cIdx)}
 >
                  <Icon icon="solar:add-circle-linear" />
                  Add Account
                </Button>
              </Card.Content>
            </Card>
          ))}
        </div>
        <Button
 size="sm"
 variant="tertiary"
 className="mt-3"
 onPress={addCompetitor}
 >
          <Icon icon="solar:add-circle-bold" />
          Add Competitor
        </Button>
      </div>
    </div>
  );
}
