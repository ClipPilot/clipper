"use client";

import { useAtom } from "jotai";
import { userAtom, isAuthenticatedAtom } from "@/store/auth";
import { authAPI, type SignInData } from "@/api/auth";
import { tokenManager } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

export function useAuth() {
  const [user, setUser] = useAtom(userAtom);
  const [isAuthenticated] = useAtom(isAuthenticatedAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const signIn = useCallback(
    async (data: SignInData) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await authAPI.signIn(data);
        setUser(response.user);
        router.push("/");
        return response;
      } catch (err: any) {
        setError(err.message || "Failed to sign in");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setUser, router]
  );

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await authAPI.signOut();
    } catch (err: any) {
      console.error("Backend signout failed:", err);
    } finally {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("user");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("token_expiry");
      }
      setIsLoading(false);
      router.push("/auth");
    }
  }, [setUser, router]);

  const getMe = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userData = await authAPI.getMe();
      setUser(userData);
      return userData;
    } catch (err: any) {
      setError(err.message || "Failed to get user");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setUser]);

  return { user, isAuthenticated, isLoading, error, signIn, signOut, getMe };
}
