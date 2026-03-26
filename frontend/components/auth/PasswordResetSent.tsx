"use client";

import React from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface PasswordResetSentProps {
  email: string;
  onContinue: () => void;
}

export default function PasswordResetSent({ email, onContinue }: PasswordResetSentProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="rounded-full bg-green-500/10 p-4">
        <Icon icon="solar:letter-bold" className="text-6xl text-green-500" />
      </div>
      <h2 className="text-2xl font-bold text-text-primary">Check Your Email</h2>
      <p className="text-center text-text-secondary">
        We&apos;ve sent password reset instructions to{" "}
        <span className="font-semibold text-text-primary">{email}</span>. Please check your inbox.
      </p>
      <Button className="mt-4 bg-accent-400 text-white font-semibold rounded-xl" size="lg" onPress={onContinue}>
        Back to Log In
      </Button>
    </div>
  );
}
