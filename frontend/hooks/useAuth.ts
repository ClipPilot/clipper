"use client";

import { useAtom } from "jotai";
import { userAtom, isAuthenticatedAtom } from "@/store/auth";
import { authAPI, SignUpData, SignInData } from "@/api/auth";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

export function useAuth() {
  const [user, setUser] = useAtom(userAtom);
  const [isAuthenticated] = useAtom(isAuthenticatedAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const signUp = useCallback(
    async (data: SignUpData) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await authAPI.signUp(data);
        setUser(response.user);
        router.push("/dashboard");
        return response;
      } catch (err: any) {
        setError(err.message || "Failed to sign up");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setUser, router]
  );

  const signIn = useCallback(
    async (data: SignInData) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await authAPI.signIn(data);
        setUser(response.user);
        router.push("/dashboard");
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
    setError(null);
    try {
      // Try to sign out from backend
      await authAPI.signOut();
    } catch (err: any) {
      // Log error but continue with local cleanup
      console.error("Backend signout failed:", err);
      setError(err.message || "Failed to sign out from server");
    } finally {
      // Always clear local state and redirect, even if backend call fails
      setUser(null);

      // Clear all localStorage items related to auth
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

  const refreshSession = useCallback(async (refreshToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authAPI.refreshSession(refreshToken);
      setUser(response.user);
      return response;
    } catch (err: any) {
      setError(err.message || "Failed to refresh session");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setUser]);

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

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    signUp,
    signIn,
    signOut,
    refreshSession,
    getMe,
  };
}


