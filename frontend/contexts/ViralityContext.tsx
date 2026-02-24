"use client";

import { createContext, useContext, useState } from "react";
import { type DateRangeValue, getMonthToDateRange } from "@/components/virality/DateRangeFilter";

interface ViralityContextValue {
  dateRange: DateRangeValue;
  setDateRange: (value: DateRangeValue) => void;
}

const ViralityContext = createContext<ViralityContextValue | null>(null);

export function ViralityProvider({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRangeValue>(getMonthToDateRange);

  return (
    <ViralityContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </ViralityContext.Provider>
  );
}

export function useViralityDateRange() {
  const ctx = useContext(ViralityContext);
  if (!ctx) throw new Error("useViralityDateRange must be used within ViralityProvider");
  return ctx;
}
