"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { userAtom } from "@/store/auth";
import { useAuth } from "@/hooks/useAuth";
import { tokenManager } from "@/lib/apiClient";
import { Button, Input, Label, TextField, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import Image from "next/image";

export default function AuthPage() {
  const router = useRouter();
  const [user] = useAtom(userAtom);
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("session_expired") === "true") {
      tokenManager.clearTokens();
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsCheckingAuth(false);
      return;
    }

    if (user) {
      router.push("/");
      return;
    }

    setIsCheckingAuth(false);
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await signIn({ email, password });
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-row min-h-screen w-full overflow-hidden bg-background">
      <div className="flex flex-col min-h-screen w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-surface p-8 shadow-lg space-y-8">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">
              Virality Tracker
            </h1>
            <p className="text-sm text-text-secondary">
              Sign in with your Cuttr account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-danger-50/10 border border-danger-200/20">
                <Icon
                  icon="solar:danger-triangle-linear"
                  width={16}
                  className="text-danger-500 shrink-0"
                />
                <p className="text-sm text-danger-500">{error}</p>
              </div>
            )}

            <TextField
              fullWidth
              isRequired
              name="email"
              type="email"
              onChange={setEmail}
            >
              <Label>Email</Label>
              <Input
                fullWidth
                placeholder="you@example.com"
                value={email}
                autoComplete="email"
              />
            </TextField>

            <div className="relative">
              <TextField
                fullWidth
                isRequired
                name="password"
                type={showPassword ? "text" : "password"}
                onChange={setPassword}
              >
                <Label>Password</Label>
                <Input
                  fullWidth
                  placeholder="Enter your password"
                  value={password}
                  autoComplete="current-password"
                  className="pr-10"
                />
              </TextField>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9.5 text-text-tertiary hover:text-text-primary transition-colors"
              >
                <Icon
                  icon={
                    showPassword
                      ? "solar:eye-closed-linear"
                      : "solar:eye-linear"
                  }
                  width={18}
                />
              </button>
            </div>

            <Button
              type="submit"
              className="w-full bg-accent-400 hover:bg-accent-500 text-white font-medium mt-2"
              isPending={isLoading}
            >
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : null}
                  {isPending ? "Signing in..." : "Sign In"}
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-text-tertiary">
            Don&apos;t have an account? Sign up at{" "}
            <a
              href="https://platform.cuttr.com/auth"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-400 hover:underline"
            >
              platform.cuttr.com
            </a>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 relative min-h-screen">
        <Image
          src="/auth.jpg"
          width={0}
          height={0}
          sizes="100vw"
          alt="Virality Tracker"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
