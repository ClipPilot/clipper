"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";

const STEPS = [
  { icon: "solar:document-text-bold-duotone", label: "Analyzing structure" },
  { icon: "solar:chat-square-bold-duotone", label: "Writing dialogue" },
  { icon: "solar:masks-bold-duotone", label: "Adding emotion tags" },
  { icon: "solar:clapperboard-open-bold-duotone", label: "Building shot list" },
  { icon: "solar:magic-stick-3-bold-duotone", label: "Generating visual prompts" },
  { icon: "solar:tuning-bold-duotone", label: "Polishing final script" },
];

const STEP_INTERVAL_MS = 6000;

export function ScriptLoadingState() {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeStep >= STEPS.length - 1) return;
    const timer = setTimeout(() => setActiveStep((s) => s + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [activeStep]);

  const currentStep = STEPS[activeStep];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
    >
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-accent-400/10 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
              transition={{ duration: 0.3 }}
            >
              <Icon icon={currentStep.icon} className="text-accent-400" width={32} />
            </motion.div>
          </AnimatePresence>
        </div>
        <motion.div
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-400 flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <Icon icon="solar:pen-bold" className="text-white" width={10} />
        </motion.div>
      </div>

      <div className="text-center space-y-1.5">
        <h3 className="text-base font-semibold text-text-primary">Writing your script</h3>
        <AnimatePresence mode="wait">
          <motion.p
            key={activeStep}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-text-muted"
          >
            {currentStep.label}...
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <div className="flex gap-1 w-full">
          {STEPS.map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-accent-400"
                initial={{ width: "0%" }}
                animate={{
                  width: i < activeStep ? "100%" : i === activeStep ? "60%" : "0%",
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          ))}
        </div>
        <span className="text-[10px] text-text-muted/60 tabular-nums">{elapsed}s</span>
      </div>
    </motion.div>
  );
}
