"use client";

import React from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface EmailConfirmationProps {
  email: string;
  onContinue: () => void;
}

export default function EmailConfirmation({ email, onContinue }: EmailConfirmationProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="rounded-full bg-green-500/10 p-4">
        <Icon icon="solar:check-circle-bold" className="text-6xl text-green-500" />
      </div>
      <h2 className="text-2xl font-bold text-text-accent">Confirm Your Email</h2>
      <p className="text-center text-text-secondary">
        We&apos;ve sent a confirmation email to{" "}
        <span className="font-semibold text-text-accent">{email}</span>. Please check your inbox and click the confirmation link.
      </p>
      <Button className="mt-4 bg-accent-400 text-white font-semibold rounded-xl" size="lg" onPress={onContinue}>
        Continue to Log In
      </Button>
    </div>
  );
}
