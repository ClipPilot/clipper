"use client";

import React, { useState } from "react";
import { Button, Input } from "@heroui/react";

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
  onSubmit: (email: string) => Promise<void>;
  error: string;
  isLoading: boolean;
}

export default function ForgotPasswordForm({
  onBackToLogin,
  onSubmit,
  error,
  isLoading,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(email);
  };

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Reset Password</h2>
        <p className="text-sm text-text-secondary mt-1">Enter your email to receive a reset link</p>
      </div>

      {error && (
        <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">Email Address</label>
          <Input
            isRequired
            name="email"
            placeholder="Enter your email"
            type="email"
            variant="flat"
            classNames={{
              inputWrapper: "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 shadow-none rounded-xl",
              input: "text-text-primary placeholder:text-text-tertiary",
              innerWrapper: "shadow-none",
            }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <Button className="bg-accent-400 text-white font-semibold mt-2 rounded-xl" type="submit" size="lg" isLoading={isLoading}>
          Send Reset Link
        </Button>
      </form>

      <p className="text-sm text-center text-text-secondary">
        Remember your password?{" "}
        <button className="text-accent-400 font-medium hover:underline" onClick={onBackToLogin}>
          Log In
        </button>
      </p>
    </>
  );
}
