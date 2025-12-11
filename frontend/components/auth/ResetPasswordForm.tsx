"use client";

import React, { useState } from "react";
import { Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";

interface ResetPasswordFormProps {
  onSubmit: (newPassword: string, confirmPassword: string) => Promise<void>;
  error: string;
  isLoading: boolean;
}

export default function ResetPasswordForm({
  onSubmit,
  error,
  isLoading,
}: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(newPassword, confirmPassword);
  };

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Set New Password</h2>
        <p className="text-sm text-text-secondary mt-1">Enter your new password below</p>
      </div>

      {error && (
        <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">New Password</label>
          <Input
            isRequired
            endContent={
              <button type="button" onClick={() => setIsVisible(!isVisible)} className="focus:outline-none">
                <Icon
                  className="text-text-tertiary text-xl"
                  icon={isVisible ? "solar:eye-closed-linear" : "solar:eye-bold"}
                />
              </button>
            }
            name="newPassword"
            placeholder="Enter your new password"
            type={isVisible ? "text" : "password"}
            variant="flat"
            classNames={{
              inputWrapper: "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 shadow-none rounded-xl",
              input: "text-text-primary placeholder:text-text-tertiary",
              innerWrapper: "shadow-none",
            }}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">Confirm Password</label>
          <Input
            isRequired
            endContent={
              <button type="button" onClick={() => setIsConfirmVisible(!isConfirmVisible)} className="focus:outline-none">
                <Icon
                  className="text-text-tertiary text-xl"
                  icon={isConfirmVisible ? "solar:eye-closed-linear" : "solar:eye-bold"}
                />
              </button>
            }
            name="confirmNewPassword"
            placeholder="Confirm your new password"
            type={isConfirmVisible ? "text" : "password"}
            variant="flat"
            classNames={{
              inputWrapper: "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 shadow-none rounded-xl",
              input: "text-text-primary placeholder:text-text-tertiary",
              innerWrapper: "shadow-none",
            }}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <Button className="bg-accent-400 text-white font-semibold mt-2 rounded-xl" type="submit" size="lg" isLoading={isLoading}>
          Reset Password
        </Button>
      </form>
    </>
  );
}
