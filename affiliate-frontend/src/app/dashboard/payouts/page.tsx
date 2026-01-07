"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function PayoutsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Payouts</h1>
        <p className="text-text-secondary mt-1">
          View and manage your commission payouts
        </p>
      </div>

      <Card className="bg-surface border border-border">
        <CardBody className="p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald/10 mx-auto mb-6 flex items-center justify-center">
            <Icon
              icon="solar:wallet-money-bold"
              className="text-4xl text-emerald"
            />
          </div>
          <h3 className="text-xl font-semibold text-text-primary mb-3">
            Coming Soon
          </h3>
          <p className="text-text-secondary max-w-md mx-auto mb-6">
            We&apos;re working on automated payouts. For now, payouts are processed
            manually at the end of each month for commissions over $50.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-elevated text-text-secondary text-sm">
            <Icon icon="solar:info-circle-bold" className="text-lg" />
            Contact support@cuttr.com for payout inquiries
          </div>
        </CardBody>
      </Card>

      {/* Payout Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-surface border border-border">
          <CardBody className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Icon
                  icon="solar:calendar-bold"
                  className="text-xl text-blue-500"
                />
              </div>
              <h3 className="font-medium text-text-primary">Payout Schedule</h3>
            </div>
            <p className="text-text-secondary text-sm">
              Payouts are processed on the 1st of each month for the previous
              month&apos;s earnings.
            </p>
          </CardBody>
        </Card>

        <Card className="bg-surface border border-border">
          <CardBody className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald/20 flex items-center justify-center">
                <Icon
                  icon="solar:dollar-minimalistic-bold"
                  className="text-xl text-emerald"
                />
              </div>
              <h3 className="font-medium text-text-primary">Minimum Payout</h3>
            </div>
            <p className="text-text-secondary text-sm">
              Minimum payout threshold is $50. Earnings below this amount roll
              over to the next month.
            </p>
          </CardBody>
        </Card>

        <Card className="bg-surface border border-border">
          <CardBody className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Icon
                  icon="solar:card-bold"
                  className="text-xl text-purple-500"
                />
              </div>
              <h3 className="font-medium text-text-primary">Payment Method</h3>
            </div>
            <p className="text-text-secondary text-sm">
              Payouts are sent via bank transfer or PayPal. Contact support to
              set up your payment details.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
