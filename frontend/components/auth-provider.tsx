"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { userAtom } from "@/store/auth";
import { authAPI } from "@/api/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useSetAtom(userAtom);

  useEffect(() => {
    const initAuth = async () => {
      const token = authAPI.isAuthenticated();

      if (token) {
        try {
          const userData = await authAPI.getMe();
          setUser(userData);
        } catch (error) {
          console.error("Failed to restore session:", error);

          if (error instanceof Error && error.message.includes("Session expired")) {
            if (typeof window !== "undefined") {
              localStorage.removeItem("access_token");
              localStorage.removeItem("refresh_token");
              localStorage.removeItem("token_expiry");
              localStorage.removeItem("remember_me");
              localStorage.removeItem("user");
              localStorage.removeItem("userTeams");
              localStorage.removeItem("selectedTeam");
            }
            setUser(null);
          }
        }
      }
    };

    initAuth();

    const refreshInterval = setInterval(async () => {
      if (authAPI.isAuthenticated()) {
        try {
          await authAPI.getMe();
        } catch (error) {
          console.error("Failed to refresh session:", error);

          if (error instanceof Error && error.message.includes("Session expired")) {
            if (typeof window !== "undefined") {
              localStorage.removeItem("access_token");
              localStorage.removeItem("refresh_token");
              localStorage.removeItem("token_expiry");
              localStorage.removeItem("remember_me");
              localStorage.removeItem("user");
              localStorage.removeItem("userTeams");
              localStorage.removeItem("selectedTeam");
            }
            setUser(null);
          }
        }
      }
    }, 4 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [setUser]);

  return <>{children}</>;
}
