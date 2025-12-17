"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom } from "@/store/auth";
import { authAPI } from "@/api/auth";
import { tokenManager } from "@/lib/apiClient";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { Icon } from "@iconify/react";
import CuttrLogo from "@/public/branding/cuttr_logo.png";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [, setUser] = useAtom(userAtom);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Check if user has a valid Supabase session (from the recovery link)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setIsAuthenticated(true);
      }

      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  const handleResetPassword = async (
    newPassword: string,
    confirmPassword: string
  ) => {
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      // Use Supabase's updateUser directly - the session is already set from the recovery link
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (data.user) {
        // Get the current session to store tokens
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData.session) {
          // Store tokens for our API client
          tokenManager.setTokens(
            sessionData.session.access_token,
            sessionData.session.refresh_token,
            sessionData.session.expires_in || 3600
          );

          // Get user info from our backend
          try {
            const userData = await authAPI.getMe();
            setUser(userData);
          } catch (e) {
            // User might not exist in our DB yet, that's ok
            console.log("Could not fetch user from backend:", e);
          }
        }

        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface-dark">
        <div className="flex flex-col items-center gap-4">
          <Icon
            icon="solar:loading-circle-bold"
            className="text-4xl animate-spin text-accent-400"
          />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="flex h-screen w-full items-center justify-end overflow-hidden p-2 sm:p-4 lg:p-8"
        style={{
          backgroundImage: "url('/images/image4.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute top-10 left-10">
          <Image
            src={CuttrLogo}
            alt="Cuttr"
            width={140}
            height={40}
            className="object-contain"
            unoptimized
          />
        </div>

        <div className="rounded-2xl bg-surface-base border border-border-base shadow-2xl flex w-full max-w-lg flex-col gap-6 p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 rounded-full bg-red-500/10">
              <Icon
                icon="solar:link-broken-bold-duotone"
                className="text-4xl text-red-500"
              />
            </div>
            <h2 className="text-2xl font-bold text-text-primary">
              Invalid Reset Link
            </h2>
            <p className="text-text-secondary">
              This password reset link is invalid or has expired. Please request
              a new one.
            </p>
            <button
              onClick={() => router.push("/auth")}
              className="mt-4 px-6 py-3 bg-accent-400 text-white font-semibold rounded-xl hover:bg-accent-500 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-full items-center justify-end overflow-hidden p-2 sm:p-4 lg:p-8"
      style={{
        backgroundImage: "url('/images/image4.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute top-10 left-10">
        <Image
          src={CuttrLogo}
          alt="Cuttr"
          width={140}
          height={40}
          className="object-contain"
          unoptimized
        />
      </div>

      <div className="absolute bottom-10 left-10 hidden md:block">
        <p className="max-w-xl text-white/60">
          <span className="font-medium">"</span>
          The future of content management is here. Cuttr makes it seamless to
          organize and share your digital world.
          <span className="font-medium">"</span>
        </p>
      </div>

      <div className="rounded-2xl bg-surface-base border border-border-base shadow-2xl flex w-full max-w-lg flex-col gap-6 p-8">
        <ResetPasswordForm
          onSubmit={handleResetPassword}
          error={error}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
