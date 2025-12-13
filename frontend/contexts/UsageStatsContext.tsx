"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface UsageStatsContextType {
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const UsageStatsContext = createContext<UsageStatsContextType | undefined>(undefined);

export function UsageStatsProvider({ children }: { children: React.ReactNode }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <UsageStatsContext.Provider value={{ refreshTrigger, triggerRefresh }}>
      {children}
    </UsageStatsContext.Provider>
  );
}

export function useUsageStatsRefresh() {
  const context = useContext(UsageStatsContext);
  if (context === undefined) {
    throw new Error("useUsageStatsRefresh must be used within UsageStatsProvider");
  }
  return context;
}
