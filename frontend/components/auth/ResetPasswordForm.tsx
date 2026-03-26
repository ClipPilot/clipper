"use client";

import React, { useState } from "react";
import { Button, TextField, Label, FieldError, InputGroup } from "@heroui/react";
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

      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <TextField fullWidth isRequired variant="secondary">
          <Label>New Password</Label>
          <InputGroup>
            <InputGroup.Input
              name="newPassword"
              placeholder="Enter your new password"
              type={isVisible ? "text" : "password"}
              value={newPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
            />
            <InputGroup.Suffix>
              <Button isIconOnly variant="tertiary" size="sm" onPress={() => setIsVisible(!isVisible)}>
                <Icon icon={isVisible ? "solar:eye-closed-linear" : "solar:eye-bold"} className="text-lg text-muted" />
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <FieldError />
        </TextField>

        <TextField fullWidth isRequired variant="secondary">
          <Label>Confirm Password</Label>
          <InputGroup>
            <InputGroup.Input
              name="confirmNewPassword"
              placeholder="Confirm your new password"
              type={isConfirmVisible ? "text" : "password"}
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            />
            <InputGroup.Suffix>
              <Button isIconOnly variant="tertiary" size="sm" onPress={() => setIsConfirmVisible(!isConfirmVisible)}>
                <Icon icon={isConfirmVisible ? "solar:eye-closed-linear" : "solar:eye-bold"} className="text-lg text-muted" />
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <FieldError />
        </TextField>

        <Button className="w-full bg-accent-400 text-white font-semibold rounded-xl" type="submit" size="lg" isPending={isLoading}>
          Reset Password
        </Button>
      </form>
    </>
  );
}
