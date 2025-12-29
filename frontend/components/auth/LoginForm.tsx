"use client";

import React, { useState } from "react";
import { Button, Input, Divider, Checkbox } from "@heroui/react";
import { Icon } from "@iconify/react";
import ContinueWithGoogle from "./ContinueWithGoogle";

interface LoginFormProps {
  onSignUp: () => void;
  onForgotPassword: () => void;
  onSubmit: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  error: string;
  isLoading: boolean;
}

export default function LoginForm({
  onSignUp,
  onForgotPassword,
  onSubmit,
  error,
  isLoading,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(email, password, rememberMe);
  };

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Welcome Back</h2>
        <p className="text-sm text-text-secondary mt-1">
          Log in to your account
        </p>
      </div>

      {error && (
        <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">
            Email Address
          </label>
          <Input
            isRequired
            name="email"
            placeholder="you@example.com"
            type="email"
            variant="flat"
            classNames={{
              inputWrapper:
                "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 shadow-none rounded-xl",
              input: "text-text-primary placeholder:text-text-tertiary",
            }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">
            Password
          </label>
          <Input
            isRequired
            endContent={
              <button type="button" onClick={() => setIsVisible(!isVisible)}>
                <Icon
                  className="text-text-tertiary text-xl"
                  icon={isVisible ? "solar:eye-closed-linear" : "solar:eye-bold"}
                />
              </button>
            }
            name="password"
            placeholder="Enter your password"
            type={isVisible ? "text" : "password"}
            variant="flat"
            classNames={{
              inputWrapper:
                "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 shadow-none rounded-xl",
              input: "text-text-primary placeholder:text-text-tertiary",
            }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between -mt-2">
          <Checkbox
            isSelected={rememberMe}
            onValueChange={setRememberMe}
            size="sm"
            classNames={{
              label: "text-sm text-text-secondary",
            }}
          >
            Remember me
          </Checkbox>
          <button
            type="button"
            className="text-sm text-accent-400 font-medium hover:underline"
            onClick={onForgotPassword}
          >
            Forgot Password?
          </button>
        </div>

        <Button
          className="bg-accent-400 text-white font-semibold mt-2 rounded-xl"
          type="submit"
          size="lg"
          isLoading={isLoading}
        >
          Log In
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-2">
        <Divider className="flex-1" />
        <span className="text-xs text-text-tertiary">OR</span>
        <Divider className="flex-1" />
      </div>

      {/* Google Button */}
      <ContinueWithGoogle />

      <p className="text-sm text-center text-text-secondary mt-2">
        Don&apos;t have an account?{" "}
        <button
          className="text-accent-400 font-medium hover:underline"
          onClick={onSignUp}
        >
          Sign Up
        </button>
      </p>
    </>
  );
}
