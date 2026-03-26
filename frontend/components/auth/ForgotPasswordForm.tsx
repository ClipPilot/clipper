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
        <h2 className="text-2xl font-bold text-text-primary">Reset Password</h2>
        <p className="text-sm text-text-secondary mt-1">Enter your email to receive a reset link</p>
      </div>

      {error && (
        <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <TextField fullWidth type="email" isRequired variant="secondary">
          <Label>Email Address</Label>
          <Input name="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FieldError />
        </TextField>

        <Button className="w-full bg-accent-400 text-white font-semibold rounded-xl" type="submit" size="lg" isPending={isLoading}>
          Send Reset Link
        </Button>
      </form>

      <p className="text-sm text-center text-text-secondary">
        Remember your password?{" "}
        <span className="text-accent-400 font-medium hover:underline cursor-pointer" onClick={onBackToLogin}>
          Log In
        </span>
      </p>
    </>
  );
}
