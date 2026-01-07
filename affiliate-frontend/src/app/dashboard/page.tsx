"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, Button, Snippet } from "@heroui/react";
import { Icon } from "@iconify/react";
import { affiliateAPI } from "@/api/affiliate";

interface AffiliateStats {
  totalAffiliates: number;
  activeAffiliates: number;
  totalCommission: number;
  unpaidCommission: number;
}

export default function DashboardPage() {
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [codeRes, statsRes] = await Promise.all([
        affiliateAPI.getCode(),
        affiliateAPI.getStats(),
      ]);
      setCode(codeRes.code);
      setStats(statsRes);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const result = await affiliateAPI.generateCode();
      setCode(result.code);
    } catch (err) {
      console.error("Failed to generate code:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">
          Welcome to your affiliate dashboard
        </p>
      </div>

      {/* Affiliate Code Section */}
      <Card className="bg-surface border border-border">
        <CardBody className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                Your Affiliate Code
              </h2>
              <p className="text-text-secondary text-sm mb-4">
                Share this code with brands to earn commission on their
                subscriptions
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald/20 flex items-center justify-center">
              <Icon icon="solar:link-bold" className="text-xl text-emerald" />
            </div>
          </div>

          {code ? (
            <Snippet
              symbol=""
              variant="bordered"
              classNames={{
                base: "bg-surface-elevated border-border",
                pre: "text-emerald font-mono text-lg",
              }}
            >
              {code}
            </Snippet>
          ) : (
            <Button
              className="bg-emerald text-black font-medium"
              isLoading={isGenerating}
              onPress={handleGenerateCode}
            >
              Generate Affiliate Code
            </Button>
          )}
        </CardBody>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface border border-border">
          <CardBody className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Icon
                  icon="solar:buildings-bold"
                  className="text-2xl text-blue-500"
                />
              </div>
              <div>
                <p className="text-text-secondary text-sm">Total Brands</p>
                <p className="text-2xl font-bold text-text-primary">
                  {stats?.totalAffiliates ?? 0}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-surface border border-border">
          <CardBody className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald/20 flex items-center justify-center">
                <Icon
                  icon="solar:check-circle-bold"
                  className="text-2xl text-emerald"
                />
              </div>
              <div>
                <p className="text-text-secondary text-sm">Active Brands</p>
                <p className="text-2xl font-bold text-text-primary">
                  {stats?.activeAffiliates ?? 0}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-surface border border-border">
          <CardBody className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Icon
                  icon="solar:dollar-bold"
                  className="text-2xl text-purple-500"
                />
              </div>
              <div>
                <p className="text-text-secondary text-sm">Total Commission</p>
                <p className="text-2xl font-bold text-text-primary">
                  ${stats?.totalCommission?.toFixed(2) ?? "0.00"}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-surface border border-border">
          <CardBody className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Icon
                  icon="solar:wallet-money-bold"
                  className="text-2xl text-orange-500"
                />
              </div>
              <div>
                <p className="text-text-secondary text-sm">Unpaid Commission</p>
                <p className="text-2xl font-bold text-text-primary">
                  ${stats?.unpaidCommission?.toFixed(2) ?? "0.00"}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Quick Tips */}
      <Card className="bg-surface border border-border">
        <CardBody className="p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald/20 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald font-semibold">1</span>
              </div>
              <div>
                <h3 className="font-medium text-text-primary">Share Your Code</h3>
                <p className="text-text-secondary text-sm mt-1">
                  Give your affiliate code to brands looking to use Cuttr
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald/20 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald font-semibold">2</span>
              </div>
              <div>
                <h3 className="font-medium text-text-primary">They Subscribe</h3>
                <p className="text-text-secondary text-sm mt-1">
                  When they sign up and subscribe using your code, you get credited
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald/20 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald font-semibold">3</span>
              </div>
              <div>
                <h3 className="font-medium text-text-primary">Earn Commission</h3>
                <p className="text-text-secondary text-sm mt-1">
                  Earn 10% commission on every payment they make
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
