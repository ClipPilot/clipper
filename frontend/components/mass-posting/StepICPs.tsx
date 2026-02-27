"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import type { ICP } from "@/types/massPosting";
import { emptyICP } from "@/constants/massPosting";

interface StepICPsProps {
  icps: ICP[];
  setIcps: (v: ICP[]) => void;
}

export function StepICPs({ icps, setIcps }: StepICPsProps) {
  const addICP = () => setIcps([...icps, emptyICP()]);

  const removeICP = (idx: number) =>
    setIcps(icps.filter((_: ICP, i: number) => i !== idx));

  const updateICP = (idx: number, field: string, value: string | string[]) => {
    const updated = [...icps];
    updated[idx] = { ...updated[idx], [field]: value };
    setIcps(updated);
  };

  const addPainPoint = (idx: number, point: string) => {
    const trimmed = point.trim();
    if (!trimmed) return;
    const current = icps[idx].painPoints ?? [];
    if (current.includes(trimmed)) return;
    updateICP(idx, "painPoints", [...current, trimmed]);
  };

  const removePainPoint = (icpIdx: number, pointIdx: number) => {
    const current = icps[icpIdx].painPoints ?? [];
    updateICP(
      icpIdx,
      "painPoints",
      current.filter((_: string, i: number) => i !== pointIdx)
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          Ideal Customer Profiles
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          Describe who your ideal customers are so we can tailor content to
          resonate with them.
        </p>
      </div>

      <div className="space-y-6">
        {icps.map((icp, idx) => (
          <Card key={idx} className="bg-surface-elevated border border-border-base">
            <CardHeader className="px-4 pt-4 pb-0 flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">
                ICP #{idx + 1}
              </span>
              {icps.length > 1 && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => removeICP(idx)}
                >
                  <Icon icon="solar:trash-bin-trash-bold" />
                </Button>
              )}
            </CardHeader>
            <CardBody className="p-4 space-y-4">
              <Input
                label="Name / Label"
                placeholder="e.g. Small Business Owner, Fitness Enthusiast"
                value={icp.name}
                onValueChange={(v) => updateICP(idx, "name", v)}
                isRequired
              />
              <Textarea
                label="Description"
                placeholder="Describe this customer segment..."
                value={icp.description}
                onValueChange={(v) => updateICP(idx, "description", v)}
                minRows={2}
                isRequired
              />
              <Input
                label="Demographics"
                placeholder="e.g. 25-45, urban professionals, US-based"
                value={icp.demographics ?? ""}
                onValueChange={(v) => updateICP(idx, "demographics", v)}
              />
              <PainPointsInput
                painPoints={icp.painPoints ?? []}
                onAdd={(point) => addPainPoint(idx, point)}
                onRemove={(pointIdx) => removePainPoint(idx, pointIdx)}
              />
            </CardBody>
          </Card>
        ))}
      </div>

      <Button
        variant="flat"
        onPress={addICP}
        startContent={<Icon icon="solar:add-circle-bold" />}
      >
        Add Another ICP
      </Button>
    </div>
  );
}

// ── Pain Points chip input ──────────────────────────────────────

function PainPointsInput({
  painPoints,
  onAdd,
  onRemove,
}: {
  painPoints: string[];
  onAdd: (point: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    onAdd(draft);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <Input
          label="Pain Points"
          placeholder="Type a pain point and press Enter"
          value={draft}
          onValueChange={setDraft}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          size="md"
          variant="flat"
          isDisabled={!draft.trim()}
          onPress={handleAdd}
          isIconOnly
        >
          <Icon icon="solar:add-circle-bold" className="text-lg" />
        </Button>
      </div>
      {painPoints.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {painPoints.map((point, idx) => (
            <Chip
              key={idx}
              variant="flat"
              onClose={() => onRemove(idx)}
            >
              {point}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
