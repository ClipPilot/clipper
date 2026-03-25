"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtom, useAtomValue } from "jotai";
import { motion } from "framer-motion";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import { Button, Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";
import { DashboardGrid } from "@/components/dashboard";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);
  const selectedTeam = useAtomValue(selectedTeamAtom);

  useEffect(() => {
    if (!user) {
      const accessToken =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;
      if (!accessToken) {
        router.push("/auth");
        return;
      }
      authAPI
        .getMe()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          router.push("/auth");
        });
    }
  }, [user, router, setUser]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-dark">
        <div className="flex flex-col items-center gap-4">
          <Icon
            icon="solar:loading-circle-bold"
            className="text-4xl animate-spin text-accent-400"
          />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  const currentPlan = selectedTeam?.plan || "free";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-surface-dark p-6 lg:p-8"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-text-accent">
              {getGreeting()}, {user?.firstName || "there"}
            </h1>
            <p className="text-text-secondary mt-1">
              Here&apos;s what&apos;s happening with your clips
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <DashboardGrid />
        </motion.div>

        {currentPlan === "free" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-accent-400/10 to-purple-500/10 border border-accent-400/20">
              <Card.Content className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent-400/20 flex items-center justify-center">
                      <Icon
                        icon="solar:rocket-bold-duotone"
                        className="text-accent-400"
                        width={26}
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-text-accent">
                        Upgrade to Pro
                      </h3>
                      <p className="text-sm text-text-secondary">
                        Unlock unlimited generations and more credits
                      </p>
                    </div>
                  </div>
                  <Button
 className="bg-accent-400 text-white font-semibold"
 onPress={() => router.push("/dashboard/pricing")}
 >
                    View Plans
                    <Icon icon="solar:arrow-right-bold" width={18} />
</Button>
                </div>
              </Card.Content>
            </Card>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
