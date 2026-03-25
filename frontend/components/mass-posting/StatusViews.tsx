"use client";

import { Button, Card, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { MassPostingDashboard } from "./dashboard";

export function LoadingView() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" color="accent" />
        <p className="text-text-secondary">Loading mass posting status...</p>
      </div>
    </div>
  );
}

export function ApprovedView() {
  return <MassPostingDashboard />;
}

export function PendingView({ status }: { status: string | null }) {
  const isAppealStatus = status === "appeal";
  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto mt-12">
        <Card className="bg-surface-base border border-border-base">
          <Card.Content className="flex flex-col items-center text-center py-16 px-8">
            <div className="w-16 h-16 bg-warning-500/10 rounded-full flex items-center justify-center mb-6">
              <Icon icon="solar:hourglass-bold-duotone" className="text-4xl text-warning-400" />
            </div>
            <h2 className="text-2xl font-bold text-text-accent mb-3">
              {isAppealStatus ? "Appeal Under Review" : "Application Under Review"}
            </h2>
            <p className="text-text-secondary max-w-md">
              {isAppealStatus
                ? "Your appeal has been submitted and is being reviewed by our team. We'll notify you once a decision has been made."
                : "Your application has been submitted and is being reviewed by our team. We'll notify you once a decision has been made."}
            </p>
            <Chip color="warning" variant="tertiary" className="mt-6">
              {isAppealStatus ? "Appeal Pending" : "Review Pending"}
            </Chip>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

export function RejectedView({
  reason,
  onAppeal,
}: {
  reason: string | null;
  onAppeal: () => void;
}) {
  return (
    <div className="min-h-screen bg-surface-dark p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto mt-12">
        <Card className="bg-surface-base border border-border-base">
          <Card.Content className="flex flex-col items-center text-center py-16 px-8">
            <div className="w-16 h-16 bg-danger-500/10 rounded-full flex items-center justify-center mb-6">
              <Icon icon="solar:close-circle-bold-duotone" className="text-4xl text-danger-500" />
            </div>
            <h2 className="text-2xl font-bold text-text-accent mb-3">
              Application Not Approved
            </h2>
            {reason && (
              <Card className="bg-danger-500/5 border border-danger-500/20 mb-6 w-full max-w-md">
                <Card.Content className="p-4">
                  <p className="text-sm text-text-secondary text-left">
                    <span className="font-semibold text-danger-500">Reason: </span>
                    {reason}
                  </p>
                </Card.Content>
              </Card>
            )}
            <p className="text-text-secondary max-w-md mb-6">
              You can update your application and submit an appeal for reconsideration.
            </p>
            <Button variant="primary"
 size="lg"
 onPress={onAppeal}
 >
              <Icon icon="solar:pen-new-round-bold" />
              Update & Appeal
            </Button>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
