"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom } from "@/store/auth";
import { authAPI } from "@/api/auth";
import { tokenManager } from "@/lib/apiClient";
import { BrandLogo } from "@/components/brand-logo";
import LoginForm from "@/components/auth/LoginForm";
import SignUpForm from "@/components/auth/SignUpForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import EmailConfirmation from "@/components/auth/EmailConfirmation";
import PasswordResetSent from "@/components/auth/PasswordResetSent";
import { Icon } from "@iconify/react";

export default function AuthPage() {
  const router = useRouter();
  const [user, setUser] = useAtom(userAtom);

  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [showPasswordResetSent, setShowPasswordResetSent] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      // Check for session_expired param (set when redirect from invalid token)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("session_expired") === "true") {
        tokenManager.clearTokens();
        setUser(null);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
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
          router.push("/dashboard");
        } catch (error) {
          // Token is invalid, clear everything
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

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const type = params.get("type");
      const accessToken = params.get("access_token");

      if (type === "recovery" && accessToken) {
        setRecoveryToken(accessToken);
        setIsResetPassword(true);
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }
    }
  }, []);

  const handleLogin = async (email: string, password: string, rememberMe: boolean) => {
    setError("");
    setIsLoading(true);

    try {
      const response = await authAPI.signIn({ email, password, rememberMe });
      setUser(response.user);
      router.push("/dashboard");
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

  const handleResetPassword = async (
    newPassword: string,
    confirmPassword: string
  ) => {
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      await authAPI.updatePassword(recoveryToken, newPassword);
      const response = await authAPI.signIn({
        email: resetEmail,
        password: newPassword,
      });
      setUser(response.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
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

    if (isResetPassword) {
      return (
        <ResetPasswordForm
          onSubmit={handleResetPassword}
          error={error}
          isLoading={isLoading}
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
      className="flex h-screen w-full items-center justify-end overflow-hidden p-2 sm:p-4 lg:p-8"
      style={{
        backgroundImage:
          "url(https://nextuipro.nyc3.cdn.digitaloceanspaces.com/components-images/black-background-texture.jpeg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Brand Logo */}
      <div className="absolute top-10 left-10">
        <div className="flex items-center gap-2">
          <BrandLogo className="text-white" size={40} />
          <p className="font-medium text-white text-xl">Clipster</p>
        </div>
      </div>

      {/* Testimonial */}
      <div className="absolute bottom-10 left-10 hidden md:block">
        <p className="max-w-xl text-white/60">
          <span className="font-medium">"</span>
          The future of content management is here. Clipster makes it seamless
          to organize and share your digital world.
          <span className="font-medium">"</span>
        </p>
      </div>

      {/* Auth Form */}
      <div className="rounded-2xl bg-surface-base border border-border-base shadow-2xl flex w-full max-w-lg flex-col gap-6 p-8">
        {renderForm()}
      </div>
    </div>
  );
}
