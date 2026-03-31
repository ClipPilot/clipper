"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Button,
  Chip,
  toast,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { PageLoader } from "@/components/ui/PageLoader";
import { useAtomValue } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { apiJson } from "@/lib/apiClient";
import API_URL from "@/config/constants";
import { ReferralCode, Referral, ReferralStats, REFERRAL_BENEFITS } from "@/types/referral";
import { getPlanColor } from "@/lib/plans";
import { formatDate } from "@/lib/formatters";

interface ReferralsResponse {
  code: ReferralCode | null;
  referrals: Referral[];
}

interface CodeResponse {
  code: ReferralCode;
}

export default function ReferralsPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchReferralData = useCallback(async () => {
    if (!selectedTeam?.id) return;

    try {
      setIsLoading(true);
      const [referralsData, statsData] = await Promise.all([
        apiJson<ReferralsResponse>(`${API_URL}/referrals/${selectedTeam.id}`),
        apiJson<ReferralStats>(`${API_URL}/referrals/${selectedTeam.id}/stats`),
      ]);

      setReferralCode(referralsData.code);
      setReferrals(referralsData.referrals);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to fetch referral data:", error);
      toast.danger("Error", { description: "Failed to load referral data" });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam?.id]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  const handleGenerateCode = async () => {
    if (!selectedTeam?.id) return;

    setIsGenerating(true);
    try {
      const response = await apiJson<CodeResponse>(`${API_URL}/referrals/${selectedTeam.id}/code`, {
        method: "POST",
      });
      setReferralCode(response.code);
      toast.success("Code generated!", { description: "Your referral code is ready to share." });
    } catch (error) {
      console.error("Failed to generate code:", error);
      toast.danger("Error", { description: "Failed to generate referral code" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode.code);
      toast.success("Copied!", { description: "Referral code copied to clipboard." });
    }
  };

  const getStatusChipClassName = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500";
      case "pending":
        return "bg-amber-500/10 text-amber-500";
      case "churned":
        return "bg-red-500/10 text-red-500";
      default:
        return "bg-zinc-500/10 text-zinc-400";
    }
  };

  const formatReward = (referral: Referral) => {
    const percentOff = parseFloat(referral.percentOff);
    if (percentOff > 0) {
      return `${percentOff}% off`;
    }
    if (referral.bonusClips > 0) {
      return `+${referral.bonusClips} clips`;
    }
    return "Pending";
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-surface-dark p-6 lg:p-8"
    >
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h1 className="text-2xl font-bold text-text-primary">
            Referral Program
          </h1>
          <p className="text-text-secondary mt-1">
            Earn rewards by referring others to Cuttr
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
            <div className="p-5">
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
                {stats?.activeReferrals ?? 0}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-accent-400/10">
                  <Icon
                    icon="solar:medal-ribbons-star-bold-duotone"
                    className="text-accent-400"
                    width={20}
                  />
                </div>
                <span className="text-sm text-text-tertiary">
                  Bonus Clips Earned
                </span>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                +{stats?.totalBonusClips ?? 0}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Icon
                    icon="solar:ticket-sale-bold-duotone"
                    className="text-amber-500"
                    width={20}
                  />
                </div>
                <span className="text-sm text-text-tertiary">
                  Total Discount
                </span>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {stats?.totalPercentOff ?? 0}%
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
        <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
          <div className="flex flex-row items-center gap-3 p-6 pb-0">
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
          </div>
          <div className="p-6 space-y-4">
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
          </div>
        </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
        <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
          <div className="flex flex-row items-center gap-3 p-6 pb-0">
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
          </div>
          <div className="p-6 space-y-4">
            {referralCode ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 flex items-center justify-between p-4 rounded-lg bg-white/[0.04]">
                  <span className="text-lg font-mono font-bold text-text-primary tracking-wider">
                    {referralCode.code}
                  </span>
                  <Button
 isIconOnly
 variant="tertiary"
 size="sm"
 className="bg-accent-400/10 text-accent-400"
 onPress={handleCopyCode}
 >
                    <Icon icon="solar:copy-bold-duotone" width={18} />
                  </Button>
                </div>
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
 onPress={handleGenerateCode}
 isPending={isGenerating}
 >
                  <Icon icon="solar:add-circle-bold-duotone" width={18} />
                  Generate Code
                </Button>
              </div>
            )}
          </div>
        </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
        <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
          <div className="flex flex-row items-center gap-3 p-6 pb-0">
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
          </div>
          <div className="p-6">
            {referrals.length > 0 ? (
              <Table
                aria-label="Referrals table"
                className="bg-transparent shadow-none p-0"
              >
                <TableHeader>
                  <TableColumn>TEAM</TableColumn>
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
                          <p className="font-medium">{referral.referredTeamName}</p>
                          <p className="text-xs text-text-tertiary">
                            {referral.referredEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-1 rounded font-medium capitalize ${getPlanColor(referral.referredPlan)}`}
                        >
                          {referral.referredPlan || "Free"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Chip
 size="sm"
 variant="tertiary"
 className={`capitalize ${getStatusChipClassName(referral.status)}`}
 >
                          {referral.status}
                        </Chip>
                      </TableCell>
                      <TableCell>{formatDate(referral.createdAt)}</TableCell>
                      <TableCell>
                        <span className="text-green-500 font-medium">
                          {formatReward(referral)}
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
          </div>
        </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
