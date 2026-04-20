"use client";

import React, { useEffect, useSyncExternalStore } from "react";

let auroraCount = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return auroraCount > 0;
}

function getServerSnapshot() {
  return false;
}

export function useHasAurora() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function AuroraBackground({ className = "" }: { className?: string }) {
  useEffect(() => {
    auroraCount += 1;
    listeners.forEach((l) => l());
    return () => {
      auroraCount = Math.max(0, auroraCount - 1);
      listeners.forEach((l) => l());
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
    >
      <div className="absolute -top-40 -left-32 h-[36rem] w-[36rem] rounded-full bg-amber-400/[0.12] blur-[140px]" />
      <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-rose-500/20 blur-[140px]" />
      <div className="absolute bottom-0 left-1/4 h-[28rem] w-[28rem] rounded-full bg-accent-400/25 blur-[140px]" />
      <div className="absolute top-10 right-1/4 h-64 w-64 rounded-full bg-violet-500/15 blur-[120px]" />
    </div>
  );
}
