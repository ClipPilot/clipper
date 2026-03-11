"use client";

import { useState, useCallback, type DragEvent, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";

interface ImageDropZoneProps {
  children: ReactNode;
  onDrop: (files: File[]) => void;
  isDisabled?: boolean;
}

export function ImageDropZone({ children, onDrop, isDisabled }: ImageDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!isDisabled) setIsDragging(true);
    },
    [isDisabled],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isDisabled) return;

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length > 0) onDrop(files);
    },
    [isDisabled, onDrop],
  );

  return (
    <div
      className="relative flex-1 flex flex-col min-h-0"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-surface-dark/80 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-accent-400 rounded-xl pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1, y: [0, -8, 0] }}
              transition={{ y: { duration: 1.5, repeat: Infinity } }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-16 h-16 rounded-2xl bg-accent-400/20 flex items-center justify-center">
                <Icon icon="solar:upload-bold-duotone" className="text-accent-400" width={32} />
              </div>
              <p className="text-text-primary font-medium">Drop product images here</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
