"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

export interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
}

export interface SpotlightTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 12;
const TOOLTIP_GAP = 12;

/** All coordinates are viewport-relative (fixed positioning). */
function getTooltipPosition(
  cutout: Rect,
  placement: "top" | "bottom" | "left" | "right",
  tooltipWidth: number,
  tooltipHeight: number
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceBelow = vh - (cutout.top + cutout.height);
  const spaceAbove = cutout.top;
  const spaceRight = vw - (cutout.left + cutout.width);
  const spaceLeft = cutout.left;

  // Auto-flip if preferred placement doesn't have room
  let resolvedPlacement = placement;
  if (resolvedPlacement === "bottom" && spaceBelow < tooltipHeight + TOOLTIP_GAP && spaceAbove > spaceBelow) {
    resolvedPlacement = "top";
  } else if (resolvedPlacement === "top" && spaceAbove < tooltipHeight + TOOLTIP_GAP && spaceBelow > spaceAbove) {
    resolvedPlacement = "bottom";
  } else if (resolvedPlacement === "right" && spaceRight < tooltipWidth + TOOLTIP_GAP && spaceLeft > spaceRight) {
    resolvedPlacement = "left";
  } else if (resolvedPlacement === "left" && spaceLeft < tooltipWidth + TOOLTIP_GAP && spaceRight > spaceLeft) {
    resolvedPlacement = "right";
  }

  let top: number;
  let left: number;

  switch (resolvedPlacement) {
    case "bottom":
      top = cutout.top + cutout.height + TOOLTIP_GAP;
      left = cutout.left + cutout.width / 2 - tooltipWidth / 2;
      break;
    case "top":
      top = cutout.top - tooltipHeight - TOOLTIP_GAP;
      left = cutout.left + cutout.width / 2 - tooltipWidth / 2;
      break;
    case "right":
      top = cutout.top + cutout.height / 2 - tooltipHeight / 2;
      left = cutout.left + cutout.width + TOOLTIP_GAP;
      break;
    case "left":
      top = cutout.top + cutout.height / 2 - tooltipHeight / 2;
      left = cutout.left - tooltipWidth - TOOLTIP_GAP;
      break;
  }

  // Clamp to viewport
  left = Math.max(TOOLTIP_GAP, Math.min(left, vw - tooltipWidth - TOOLTIP_GAP));
  top = Math.max(TOOLTIP_GAP, Math.min(top, vh - tooltipHeight - TOOLTIP_GAP));

  return { top, left };
}

export default function SpotlightTour({
  steps,
  isOpen,
  onClose,
}: SpotlightTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [cutout, setCutout] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const remeasureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset step on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  // Portal mount guard (SSR safety)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Measure target element in viewport coordinates
  const measureTarget = useCallback(() => {
    if (!isOpen || !steps[currentStep]) return;

    const step = steps[currentStep];
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setCutout(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setCutout({
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    });
  }, [isOpen, currentStep, steps]);

  // On step change: scroll into view, then measure (with re-measure after scroll settles)
  useEffect(() => {
    if (!isOpen || !steps[currentStep]) return;

    const step = steps[currentStep];
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setCutout(null);
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Measure immediately for instant feedback
    measureTarget();

    // Re-measure after smooth scroll finishes (~400ms)
    if (remeasureTimerRef.current) clearTimeout(remeasureTimerRef.current);
    remeasureTimerRef.current = setTimeout(measureTarget, 400);

    return () => {
      if (remeasureTimerRef.current) clearTimeout(remeasureTimerRef.current);
    };
  }, [isOpen, currentStep, steps, measureTarget]);

  // Re-measure on scroll (captures inner scrollable containers too) and resize
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);

    return () => {
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [isOpen, measureTarget]);

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      onClose();
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  if (!mounted || !isOpen) return null;

  const step = steps[currentStep];
  const placement = step?.placement ?? "bottom";

  // Compute tooltip position (all viewport-relative)
  const tooltipRect = tooltipRef.current?.getBoundingClientRect();
  const tooltipW = tooltipRect?.width ?? 320;
  const tooltipH = tooltipRect?.height ?? 180;

  const tooltipPos = cutout
    ? getTooltipPosition(cutout, placement, tooltipW, tooltipH)
    : {
        top: window.innerHeight / 2 - tooltipH / 2,
        left: window.innerWidth / 2 - tooltipW / 2,
      };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="spotlight-tour"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999]"
          style={{ pointerEvents: "auto" }}
        >
          {/* Overlay: click to skip */}
          <div
            className="absolute inset-0"
            onClick={onClose}
            style={{ cursor: "pointer" }}
          />

          {/* Cutout spotlight */}
          {cutout && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute rounded-xl"
              style={{
                top: cutout.top,
                left: cutout.left,
                width: cutout.width,
                height: cutout.height,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}

          {/* Dark overlay when target not found */}
          {!cutout && (
            <div
              className="absolute inset-0 bg-black/70"
              style={{ pointerEvents: "none" }}
            />
          )}

          {/* Tooltip card */}
          <motion.div
            ref={tooltipRef}
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="absolute z-10 w-[320px] bg-surface-base border border-border-accent rounded-xl shadow-2xl p-5"
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
              pointerEvents: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step counter */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-accent-400 bg-accent-400/10 px-2 py-1 rounded-full">
                {currentStep + 1} of {steps.length}
              </span>
              <button
                onClick={onClose}
                className="text-text-tertiary hover:text-text-accent transition-colors"
              >
                <Icon icon="solar:close-circle-bold" width={20} />
              </button>
            </div>

            {/* Title & description */}
            <h3 className="text-base font-semibold text-text-accent mb-1">
              {step.title}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              {!cutout
                ? "Upload a video first to see this element."
                : step.description}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
 size="sm"
 variant="tertiary"
 onPress={onClose}
 className="text-text-tertiary"
 >
                Skip
              </Button>
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button size="sm" variant="outline" onPress={goBack}>
                    Back
                  </Button>
                )}
                <Button variant="primary" size="sm" onPress={goNext}>
                  {currentStep === steps.length - 1 ? "Done" : "Next"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
