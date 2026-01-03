"use client";

import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface ScalePlanRequiredProps {
  currentPlan: string;
}

export function ScalePlanRequired({ currentPlan }: ScalePlanRequiredProps) {
  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-accent-400/10 flex items-center justify-center mx-auto">
              <Icon icon="solar:mask-happly-bold-duotone" className="text-accent-400" width={40} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-text-primary">UGC Studio</h1>
              <p className="text-text-secondary">
                Create AI-powered face swaps and more with UGC Studio.
              </p>
            </div>
            <Button
              as="a"
              href="/dashboard/pricing"
              className="bg-accent-400 text-white font-semibold"
              size="lg"
              startContent={<Icon icon="solar:arrow-up-bold" width={20} />}
            >
              Upgrade to Scale
            </Button>
            <p className="text-xs text-text-muted">
              Currently on: <span className="capitalize font-medium">{currentPlan}</span> plan
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
