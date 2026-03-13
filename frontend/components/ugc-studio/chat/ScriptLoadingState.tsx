"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

export function ScriptLoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col items-center justify-center gap-4 p-8"
    >
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-accent-400/10 flex items-center justify-center">
          <Icon icon="solar:document-text-bold-duotone" className="text-accent-400" width={32} />
        </div>
        <motion.div
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-400 flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <Icon icon="solar:pen-bold" className="text-white" width={10} />
        </motion.div>
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-base font-semibold text-text-primary">Writing your script</h3>
        <p className="text-xs text-text-muted max-w-xs">
          Crafting dialogue, emotion tags, and visual prompts for each scene...
        </p>
      </div>

      {/* Animated dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-accent-400"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
