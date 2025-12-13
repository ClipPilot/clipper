"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom, selectedTeamAtom } from "@/store/auth";
import { Button, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";
import { clipsAPI, Clip } from "@/api/clips";
import { getWelcomeMessage } from "@/config/constants";
import { ClipCard } from "@/components/clips/ClipCard";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const [welcomeMessage, setWelcomeMessage] = useState<string>("");
  const [recentClips, setRecentClips] = useState<Clip[]>([]);
  const [isLoadingClips, setIsLoadingClips] = useState(false);

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

  useEffect(() => {
    if (user?.firstName) {
      setWelcomeMessage(getWelcomeMessage(user.firstName));
    }
  }, [user]);

  useEffect(() => {
    if (selectedTeam?.id) {
      loadRecentClips();
    }
  }, [selectedTeam]);

  const loadRecentClips = async () => {
    if (!selectedTeam?.id) return;
    
    setIsLoadingClips(true);
    try {
      const clips = await clipsAPI.getClips(selectedTeam.id);
      const sorted = clips.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ).slice(0, 4);
      setRecentClips(sorted);
    } catch (error) {
      console.error("Failed to load clips:", error);
    } finally {
      setIsLoadingClips(false);
    }
  };

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
          <Icon
            icon="solar:loading-circle-bold"
            className="text-4xl animate-spin text-accent-400"
          />
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
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              Dashboard
            </h1>
            <p className="text-text-secondary text-lg">
              {welcomeMessage}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-surface-base border border-border-accent hover:bg-surface-elevated transition-colors">
            <CardBody className="flex flex-col items-center justify-center p-6">
              <Icon
                icon="solar:video-library-bold-duotone"
                className="text-5xl text-accent-400 mb-3"
              />
              <p className="text-2xl font-bold text-text-primary">0</p>
              <p className="text-text-secondary">Clips Generated</p>
            </CardBody>
          </Card>

          <Card className="bg-surface-base border border-border-accent hover:bg-surface-elevated transition-colors">
            <CardBody className="flex flex-col items-center justify-center p-6">
              <Icon
                icon="solar:chart-2-bold-duotone"
                className="text-5xl text-accent-400 mb-3"
              />
              <p className="text-2xl font-bold text-text-primary">0</p>
              <p className="text-text-secondary">Videos Processed</p>
            </CardBody>
          </Card>

          <Card className="bg-surface-base border border-border-accent hover:bg-surface-elevated transition-colors">
            <CardBody className="flex flex-col items-center justify-center p-6">
              <Icon
                icon="solar:clock-circle-bold-duotone"
                className="text-5xl text-accent-400 mb-3"
              />
              <p className="text-2xl font-bold text-text-primary">0h</p>
              <p className="text-text-secondary">Time Saved</p>
            </CardBody>
          </Card>
        </div>

        <Card className="bg-surface-base border border-border-base">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:history-bold-duotone"
                  className="text-2xl text-accent-400"
                />
                <h2 className="text-xl font-bold text-text-primary">
                  Recent Clips
                </h2>
              </div>
              {recentClips.length > 0 && (
                <Button
                  onClick={() => router.push("/dashboard/clips")}
                  variant="bordered"
                  className="text-sm text-text-secondary hover:text-accent-400"
                >
                  View All
                </Button>
              )}
            </div>
          </CardHeader>
          <Divider className="bg-border-base" />
          <CardBody>
            {isLoadingClips ? (
              <div className="flex items-center justify-center py-12">
                <Icon
                  icon="solar:loading-circle-bold"
                  className="text-4xl animate-spin text-accent-400"
                />
              </div>
            ) : recentClips.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentClips.map((clip) => (
                  <ClipCard key={clip.id} clip={clip} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Icon
                  icon="solar:video-frame-play-vertical-bold-duotone"
                  className="text-6xl text-text-tertiary mb-4"
                />
                <p className="text-text-secondary text-center mb-2 text-lg">
                  Ready to create your first marketing clip?
                </p>
                <p className="text-text-tertiary text-center text-sm max-w-md">
                  Upload a long-form video and let AI automatically find the best moments for social media
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
