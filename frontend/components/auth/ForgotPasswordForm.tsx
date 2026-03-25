"use client";

import React, { useState } from "react";
import { Button, Input, TextField, Label, FieldError } from "@heroui/react";

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
        <h2 className="text-2xl font-bold text-text-accent">Reset Password</h2>
        <p className="text-sm text-text-secondary mt-1">Enter your email to receive a reset link</p>
      </div>

      {error && (
        <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <TextField type="email" isRequired>
          <Label>Email Address</Label>
          <Input
            name="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError />
        </TextField>

        <Button
          className="bg-accent-400 text-white font-semibold mt-2 rounded-xl"
          type="submit"
          size="lg"
          isPending={isLoading}
        >
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
