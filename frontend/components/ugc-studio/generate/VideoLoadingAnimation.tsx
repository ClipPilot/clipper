"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, Progress, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import type { VideoGenerationStatus } from "@/api/ugc/video";
import { BrandLogo } from "@/components/brand-logo";

interface VideoLoadingAnimationProps {
  status: VideoGenerationStatus | null;
  totalScenes: number;
  onCancel?: () => void;
}

const CREATION_MESSAGES = [
  "Generating voice-over audio...",
  "Animating your scenes...",
  "Adding cinematic effects...",
  "Assembling your video...",
  "Applying final touches...",
];

export function VideoLoadingAnimation({
  status,
  totalScenes,
  onCancel,
}: VideoLoadingAnimationProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const progress = status?.progress ?? 0;
  const progressMessage = status?.progressMessage ?? "Preparing...";

  // Rotate through messages while generating
  useEffect(() => {
    if (status?.status !== "generating" && status?.status !== "queued") return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % CREATION_MESSAGES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [status?.status]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-lg">
        {/* Main animation container */}
        <div className="relative mb-8">
          {/* Background glow effect */}
          <div className="absolute inset-0 blur-3xl opacity-30">
            <div className="w-full h-full bg-gradient-to-br from-accent-400 via-purple-500 to-blue-500 rounded-full animate-pulse" />
          </div>

          {/* Central card */}
          <Card className="bg-surface-elevated/90 backdrop-blur-xl border border-border-base relative z-10">
            <CardBody className="p-8">
              {/* Animated Cuttr logo */}
              <div className="flex justify-center mb-6">
                <motion.div
                  className="relative"
                  animate={{
                    scale: [1, 1.08, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  {/* Outer pulse ring */}
                  <motion.div
                    className="absolute inset-0 w-28 h-28 rounded-full"
                    style={{
                      background: "radial-gradient(circle, rgba(79, 71, 230, 0.3) 0%, transparent 70%)",
                    }}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.6, 0, 0.6],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />

                  {/* Second pulse ring with delay */}
                  <motion.div
                    className="absolute inset-0 w-28 h-28 rounded-full"
                    style={{
                      background: "radial-gradient(circle, rgba(41, 162, 241, 0.25) 0%, transparent 70%)",
                    }}
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: 0.5,
                    }}
                  />

                  {/* Logo container */}
                  <div className="w-28 h-28 flex items-center justify-center">
                    <motion.div
                      animate={{
                        opacity: [0.8, 1, 0.8],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <BrandLogo size={72} />
                    </motion.div>
                  </div>
                </motion.div>
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-text-primary text-center mb-2">
                Creating Your Video
              </h2>

              {/* Rotating message */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={messageIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-text-secondary text-center mb-6"
                >
                  {CREATION_MESSAGES[messageIndex]}
                </motion.p>
              </AnimatePresence>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-text-muted mb-2">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress
                  value={progress}
                  size="md"
                  classNames={{
                    track: "bg-surface-base",
                    indicator: "bg-gradient-to-r from-accent-400 to-purple-500",
                  }}
                />
              </div>

              {/* Current status message */}
              <p className="text-xs text-text-muted text-center">
                {progressMessage}
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Scene progress cards */}
        <div className="space-y-2">
          {[...Array(totalScenes)].map((_, index) => {
            const sceneNum = index + 1;
            const currentScene = status?.currentScene ?? 0;
            let sceneStatus: "pending" | "processing" | "completed" = "pending";

            if (currentScene > sceneNum) {
              sceneStatus = "completed";
            } else if (currentScene === sceneNum) {
              sceneStatus = "processing";
            }

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                    sceneStatus === "completed"
                      ? "bg-accent-400/10 border border-accent-400/30"
                      : sceneStatus === "processing"
                      ? "bg-purple-500/10 border border-purple-500/30"
                      : "bg-surface-elevated border border-border-base"
                  }`}
                >
                  {/* Status icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      sceneStatus === "completed"
                        ? "bg-accent-400/20"
                        : sceneStatus === "processing"
                        ? "bg-purple-500/20"
                        : "bg-surface-base"
                    }`}
                  >
                    {sceneStatus === "completed" ? (
                      <Icon
                        icon="solar:check-circle-bold"
                        className="text-accent-400"
                        width={18}
                      />
                    ) : sceneStatus === "processing" ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      >
                        <Icon
                          icon="solar:refresh-bold"
                          className="text-purple-400"
                          width={18}
                        />
                      </motion.div>
                    ) : (
                      <Icon
                        icon="solar:clock-circle-linear"
                        className="text-text-muted"
                        width={18}
                      />
                    )}
                  </div>

                  {/* Scene info */}
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        sceneStatus === "completed"
                          ? "text-accent-400"
                          : sceneStatus === "processing"
                          ? "text-purple-400"
                          : "text-text-muted"
                      }`}
                    >
                      Scene {sceneNum}
                    </p>
                  </div>

                  {/* Status label */}
                  <span
                    className={`text-xs font-medium ${
                      sceneStatus === "completed"
                        ? "text-accent-400"
                        : sceneStatus === "processing"
                        ? "text-purple-400"
                        : "text-text-muted"
                    }`}
                  >
                    {sceneStatus === "completed"
                      ? "Done"
                      : sceneStatus === "processing"
                      ? "Processing..."
                      : "Queued"}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Estimated time / info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-text-muted">
            This typically takes 2-5 minutes. You can leave this page and come back later.
          </p>
        </div>

        {/* Close button */}
        {onCancel && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="bordered"
              className="border-border-base text-text-secondary"
              onPress={onCancel}
              startContent={<Icon icon="solar:close-circle-linear" width={18} />}
            >
              Close & Return to Menu
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
