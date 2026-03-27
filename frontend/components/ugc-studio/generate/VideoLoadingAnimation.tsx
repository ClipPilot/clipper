"use client";

import { useEffect, useState } from "react";
import { ProgressBar, Button } from "@heroui/react";
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
          <div className="rounded-xl border border-border-base overflow-hidden bg-surface-elevated/90 backdrop-blur-xl relative z-10">
            <div className="p-8">
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
                <ProgressBar
 value={progress}
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
              </div>

              {/* Current status message */}
              <p className="text-xs text-text-muted text-center">
                {progressMessage}
              </p>
            </div>
          </div>
        </div>


        {/* Close button */}
        {onCancel && (
          <div className="mt-6 flex justify-center">
            <Button
 variant="outline"
 className="border-border-base text-text-secondary"
 onPress={onCancel}
 >
              <Icon icon="solar:close-circle-linear" width={18} />
              Close & Return to Menu
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
