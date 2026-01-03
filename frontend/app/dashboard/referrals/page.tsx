"use client";

import React, { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Divider,
  Chip,
  addToast,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { REFERRAL_BENEFITS, Referral } from "@/types/referral";
import {
  mockReferralCodes,
  mockReferrals,
  generateReferralCode,
} from "@/mocks/referral-data";

export default function ReferralsPage() {
  const [referralCodes, setReferralCodes] = useState(mockReferralCodes);
  const [referrals] = useState<Referral[]>(mockReferrals);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeCode = referralCodes.find((c) => c.isActive);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    await new Promise((r) => setTimeout(r, 500));
    const newCode = {
      id: String(referralCodes.length + 1),
      code: generateReferralCode(),
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    setReferralCodes((prev) =>
      prev.map((c) => ({ ...c, isActive: false })).concat(newCode)
    );
    setIsGenerating(false);
    addToast({
      title: "Code generated!",
      description: "Your new referral code is ready to share.",
      color: "success",
    });
  };

  const handleCopyCode = () => {
    if (activeCode) {
      navigator.clipboard.writeText(activeCode.code);
      addToast({
        title: "Copied!",
        description: "Referral code copied to clipboard.",
        color: "success",
      });
    }
  };

  const totalMonthlyCredits = referrals
    .filter((r) => r.status === "active" && r.plan !== "enterprise")
    .reduce((sum, r) => sum + r.monthlyBenefit, 0);

  const enterpriseReferrals = referrals.filter(
    (r) => r.status === "active" && r.plan === "enterprise"
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "pending":
        return "warning";
      case "churned":
        return "danger";
      default:
        return "default";
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return "bg-amber-500/10 text-amber-500";
      case "scale":
        return "bg-purple-500/10 text-purple-500";
      case "studio":
        return "bg-accent-400/10 text-accent-400";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Referral Program
          </h1>
          <p className="text-text-secondary mt-1">
            Earn rewards by referring others to Cuttr
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Icon
                    icon="solar:users-group-rounded-bold-duotone"
                    className="text-green-500"
                    width={20}
                  />
                </div>
                <span className="text-sm text-text-tertiary">
                  Active Referrals
                </span>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {referrals.filter((r) => r.status === "active").length}
              </p>
            </CardBody>
          </Card>

          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-accent-400/10">
                  <Icon
                    icon="solar:medal-ribbons-star-bold-duotone"
                    className="text-accent-400"
                    width={20}
                  />
                </div>
                <span className="text-sm text-text-tertiary">
                  Monthly Credits
                </span>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                +{totalMonthlyCredits}
              </p>
            </CardBody>
          </Card>

          <Card className="bg-surface-base border border-border-base">
            <CardBody className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Icon
                    icon="solar:ticket-sale-bold-duotone"
                    className="text-amber-500"
                    width={20}
                  />
                </div>
                <span className="text-sm text-text-tertiary">
                  Enterprise Discount
                </span>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {enterpriseReferrals.length > 0 ? "10%" : "0%"}
              </p>
            </CardBody>
          </Card>
        </div>

        <Card className="bg-surface-base border border-border-base">
          <CardHeader className="flex flex-row items-center gap-3 pb-0">
            <Icon
              icon="solar:gift-bold-duotone"
              className="text-amber-500"
              width={24}
            />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Your Rewards
              </h2>
              <p className="text-sm text-text-tertiary">
                What you earn for each referral
              </p>
            </div>
          </CardHeader>
          <CardBody className="gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Chip size="sm" className="bg-amber-500/10 text-amber-500">
                    Enterprise
                  </Chip>
                </div>
                <p className="text-xl font-bold text-text-primary mb-1">
                  {REFERRAL_BENEFITS.enterprise.value}% Off
                </p>
                <p className="text-sm text-text-tertiary">
                  {REFERRAL_BENEFITS.enterprise.description}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Chip size="sm" className="bg-purple-500/10 text-purple-500">
                    Scale
                  </Chip>
                </div>
                <p className="text-xl font-bold text-text-primary mb-1">
                  +{REFERRAL_BENEFITS.scale.value} Credits
                </p>
                <p className="text-sm text-text-tertiary">
                  {REFERRAL_BENEFITS.scale.description}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-accent-400/5 border border-accent-400/20">
                <div className="flex items-center gap-2 mb-2">
                  <Chip size="sm" className="bg-accent-400/10 text-accent-400">
                    Studio
                  </Chip>
                </div>
                <p className="text-xl font-bold text-text-primary mb-1">
                  +{REFERRAL_BENEFITS.studio.value} Credits
                </p>
                <p className="text-sm text-text-tertiary">
                  {REFERRAL_BENEFITS.studio.description}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-surface-base border border-border-base">
          <CardHeader className="flex flex-row items-center gap-3 pb-0">
            <Icon
              icon="solar:link-bold-duotone"
              className="text-accent-400"
              width={24}
            />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Your Referral Code
              </h2>
              <p className="text-sm text-text-tertiary">
                Share this code with others
              </p>
            </div>
          </CardHeader>
          <CardBody className="gap-4">
            {activeCode ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 flex items-center justify-between p-4 rounded-lg bg-surface-elevated border border-border-base">
                  <span className="text-lg font-mono font-bold text-text-primary tracking-wider">
                    {activeCode.code}
                  </span>
                  <Button
                    isIconOnly
                    variant="flat"
                    size="sm"
                    className="bg-accent-400/10 text-accent-400"
                    onPress={handleCopyCode}
                  >
                    <Icon icon="solar:copy-bold-duotone" width={18} />
                  </Button>
                </div>
                <Button
                  variant="flat"
                  className="bg-surface-elevated text-text-secondary"
                  startContent={
                    <Icon icon="solar:refresh-bold-duotone" width={18} />
                  }
                  onPress={handleGenerateCode}
                  isLoading={isGenerating}
                >
                  Generate New
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="p-4 rounded-full bg-accent-400/10">
                  <Icon
                    icon="solar:link-bold-duotone"
                    className="text-accent-400"
                    width={32}
                  />
                </div>
                <div className="text-center">
                  <p className="text-text-primary font-medium mb-1">
                    No referral code yet
                  </p>
                  <p className="text-sm text-text-tertiary">
                    Generate your first code to start earning
                  </p>
                </div>
                <Button
                  className="bg-accent-400 text-white font-medium"
                  startContent={
                    <Icon icon="solar:add-circle-bold-duotone" width={18} />
                  }
                  onPress={handleGenerateCode}
                  isLoading={isGenerating}
                >
                  Generate Code
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="bg-surface-base border border-border-base">
          <CardHeader className="flex flex-row items-center gap-3 pb-0">
            <Icon
              icon="solar:users-group-rounded-bold-duotone"
              className="text-accent-400"
              width={24}
            />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Your Referrals
              </h2>
              <p className="text-sm text-text-tertiary">
                People you&apos;ve referred to Cuttr
              </p>
            </div>
          </CardHeader>
          <CardBody>
            {referrals.length > 0 ? (
              <Table
                aria-label="Referrals table"
                classNames={{
                  wrapper: "bg-transparent shadow-none p-0",
                  th: "bg-surface-elevated text-text-secondary font-medium",
                  td: "text-text-primary",
                }}
              >
                <TableHeader>
                  <TableColumn>NAME</TableColumn>
                  <TableColumn>PLAN</TableColumn>
                  <TableColumn>STATUS</TableColumn>
                  <TableColumn>SIGNED UP</TableColumn>
                  <TableColumn>REWARD</TableColumn>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{referral.refereeName}</p>
                          <p className="text-xs text-text-tertiary">
                            {referral.refereeEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-1 rounded font-medium capitalize ${getPlanColor(referral.plan)}`}
                        >
                          {referral.plan}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="sm"
                          color={getStatusColor(referral.status)}
                          variant="flat"
                          className="capitalize"
                        >
                          {referral.status}
                        </Chip>
                      </TableCell>
                      <TableCell>{formatDate(referral.signedUpAt)}</TableCell>
                      <TableCell>
                        <span className="text-green-500 font-medium">
                          {referral.plan === "enterprise"
                            ? `${referral.monthlyBenefit}% off`
                            : `+${referral.monthlyBenefit}/mo`}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="p-4 rounded-full bg-surface-elevated">
                  <Icon
                    icon="solar:users-group-rounded-bold-duotone"
                    className="text-text-tertiary"
                    width={32}
                  />
                </div>
                <div className="text-center">
                  <p className="text-text-primary font-medium mb-1">
                    No referrals yet
                  </p>
                  <p className="text-sm text-text-tertiary">
                    Share your code to start earning rewards
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
