"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom } from "@/store/auth";
import { authAPI } from "@/api/auth";
import { tokenManager } from "@/lib/apiClient";
import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";
import SignUpForm from "@/components/auth/SignUpForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import EmailConfirmation from "@/components/auth/EmailConfirmation";
import PasswordResetSent from "@/components/auth/PasswordResetSent";
import { Icon } from "@iconify/react";
import CuttrLogo from "@/public/branding/cuttr_logo.png";

export default function AuthPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);

  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [showPasswordResetSent, setShowPasswordResetSent] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  // Check for recovery token in hash and redirect to dedicated page
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const type = params.get("type");
      const accessToken = params.get("access_token");

      if (type === "recovery" && accessToken) {
        // Redirect to dedicated reset password page with token
        router.push(`/reset-password#${hash.substring(1)}`);
        return;
      }
    }
  }, [router]);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      // Check for session_expired param (set when redirect from invalid token)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("session_expired") === "true") {
        tokenManager.clearTokens();
        setUser(null);
        // Clean up URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
        setIsCheckingAuth(false);
        return;
      }

      if (user) {
        router.push("/dashboard");
        return;
      }

      const accessToken = tokenManager.getAccessToken();

      if (accessToken) {
        try {
          const userData = await authAPI.getMe();
          setUser(userData);

          const pendingInviteToken = localStorage.getItem("pendingInviteToken");
          if (pendingInviteToken) {
            localStorage.removeItem("pendingInviteToken");
            router.push(`/invite/${pendingInviteToken}`);
          } else {
            router.push("/dashboard");
          }
        } catch (error) {
          tokenManager.clearTokens();
          setIsCheckingAuth(false);
        }
      } else {
        // No access token - clear any stale data
        tokenManager.clearTokens();
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [user, router, setUser]);

  const handleLogin = async (
    email: string,
    password: string,
    rememberMe: boolean
  ) => {
    setError("");
    setIsLoading(true);

    try {
      const response = await authAPI.signIn({ email, password, rememberMe });
      setUser(response.user);

      const pendingInviteToken = localStorage.getItem("pendingInviteToken");
      if (pendingInviteToken) {
        localStorage.removeItem("pendingInviteToken");
        router.push(`/invite/${pendingInviteToken}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    setError("");
    setIsLoading(true);

    try {
      await authAPI.signUp({ email, password, firstName, lastName });
      setSignupEmail(email);
      setShowEmailConfirmation(true);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    setError("");
    setIsLoading(true);

    try {
      await authAPI.resetPassword(email);
      setResetEmail(email);
      setShowPasswordResetSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => {
    if (showEmailConfirmation) {
      return (
        <EmailConfirmation
          email={signupEmail}
          onContinue={() => {
            setShowEmailConfirmation(false);
            setIsSignUp(false);
          }}
        />
      );
    }

    if (showPasswordResetSent) {
      return (
        <PasswordResetSent
          email={resetEmail}
          onContinue={() => {
            setShowPasswordResetSent(false);
            setIsForgotPassword(false);
          }}
        />
      );
    }

    if (isForgotPassword) {
      return (
        <ForgotPasswordForm
          onBackToLogin={() => setIsForgotPassword(false)}
          onSubmit={handleForgotPassword}
          error={error}
          isLoading={isLoading}
        />
      );
    }

    if (isSignUp) {
      return (
        <SignUpForm
          onLogin={() => setIsSignUp(false)}
          onSubmit={handleSignUp}
          onClearError={() => setError("")}
          error={error}
          isLoading={isLoading}
        />
      );
    }

    return (
      <LoginForm
        onSignUp={() => setIsSignUp(true)}
        onForgotPassword={() => setIsForgotPassword(true)}
        onSubmit={handleLogin}
        error={error}
        isLoading={isLoading}
      />
    );
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface-dark">
        <div className="flex flex-col items-center gap-4">
          <Icon
            icon="solar:loading-circle-bold"
            className="text-4xl animate-spin text-accent-400"
          />
          <p className="text-text-secondary">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-full items-center justify-center overflow-hidden p-2 sm:p-4 lg:p-8"
      style={{
        backgroundImage: "url('/images/image4.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Brand Logo */}
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

      {/* Auth Form */}
      <div className="rounded-2xl bg-surface-base border border-border-base shadow-2xl flex w-full max-w-lg flex-col gap-6 p-8">
        {renderForm()}
      </div>
    </div>
  );
}
