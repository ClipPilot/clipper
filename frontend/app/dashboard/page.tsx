"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom } from "@/store/auth";
import { Button, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);

  useEffect(() => {
    // Check if user is authenticated
    if (!user) {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      if (!accessToken) {
        router.push("/auth");
        return;
      }

      // Try to fetch user data
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

  const handleSignOut = async () => {
    try {
      await authAPI.signOut();
      setUser(null);
      router.push("/auth");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-dark">
        <div className="flex flex-col items-center gap-4">
          <Icon icon="solar:loading-circle-bold" className="text-4xl animate-spin text-accent-400" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">Dashboard</h1>
            <p className="text-text-secondary">Welcome back, {user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-surface-base border border-border-accent hover:bg-surface-elevated transition-colors">
            <CardBody className="flex flex-col items-center justify-center p-6">
              <Icon icon="solar:video-library-bold-duotone" className="text-5xl text-accent-400 mb-3" />
              <p className="text-2xl font-bold text-text-primary">0</p>
              <p className="text-text-secondary">Total Clips</p>
            </CardBody>
          </Card>

          <Card className="bg-surface-base border border-border-accent hover:bg-surface-elevated transition-colors">
            <CardBody className="flex flex-col items-center justify-center p-6">
              <Icon icon="solar:folder-bold-duotone" className="text-5xl text-accent-400 mb-3" />
              <p className="text-2xl font-bold text-text-primary">0</p>
              <p className="text-text-secondary">Collections</p>
            </CardBody>
          </Card>

          <Card className="bg-surface-base border border-border-accent hover:bg-surface-elevated transition-colors">
            <CardBody className="flex flex-col items-center justify-center p-6">
              <Icon icon="solar:share-bold-duotone" className="text-5xl text-accent-400 mb-3" />
              <p className="text-2xl font-bold text-text-primary">0</p>
              <p className="text-text-secondary">Shared</p>
            </CardBody>
          </Card>
        </div>

        <Card className="bg-surface-base border border-border-base">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="solar:history-bold-duotone" className="text-2xl text-accent-400" />
              <h2 className="text-xl font-bold text-text-primary">Recent Activity</h2>
            </div>
          </CardHeader>
          <Divider className="bg-border-base" />
          <CardBody>
            <div className="flex flex-col items-center justify-center py-12">
              <Icon icon="solar:inbox-bold-duotone" className="text-6xl text-text-tertiary mb-4" />
              <p className="text-text-secondary text-center">
                No activity yet. Start clipping to see your recent activity here!
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
