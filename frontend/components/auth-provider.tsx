"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { userAtom } from "@/store/auth";
import { authAPI } from "@/api/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useSetAtom(userAtom);

  useEffect(() => {
    // Check if we have a valid session on mount
    const initAuth = async () => {
      const token = authAPI.isAuthenticated();

      if (token) {
        try {
          const userData = await authAPI.getMe();
          setUser(userData);
        } catch (error) {
          // Token is invalid or expired, clear it
          console.error("Failed to restore session:", error);
          setUser(null);
        }
      }
    };

    initAuth();

    // Set up periodic token refresh check (every 4 minutes)
    const refreshInterval = setInterval(async () => {
      if (authAPI.isAuthenticated()) {
        try {
          await authAPI.getMe(); // This will automatically refresh if needed
        } catch (error) {
          console.error("Failed to refresh session:", error);
          setUser(null);
        }
      }
    }, 4 * 60 * 1000); // 4 minutes

    return () => clearInterval(refreshInterval);
  }, [setUser]);

  return <>{children}</>;
}
