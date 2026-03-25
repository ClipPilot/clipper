"use client";

import React, { useState } from "react";
import { Button, Input, Checkbox, Separator, TextField, Label, FieldError } from "@heroui/react";
import { Icon } from "@iconify/react";
import ContinueWithGoogle from "./ContinueWithGoogle";

interface SignUpFormProps {
  onLogin: () => void;
  onSubmit: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  onClearError: () => void;
  error: string;
  isLoading: boolean;
}

export default function SignUpForm({
  onLogin,
  onSubmit,
  onClearError,
  error,
  isLoading,
}: SignUpFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    setLocalError("");

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    await onSubmit(email, password, firstName, lastName);
  };

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-text-accent">Create Account</h2>
        <p className="text-sm text-text-secondary mt-1">Sign up to get started</p>
      </div>

      {(error || localError) && (
        <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error || localError}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <TextField isRequired>
            <Label>First Name</Label>
            <Input
              placeholder="John"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <FieldError />
          </TextField>
          <TextField isRequired>
            <Label>Last Name</Label>
            <Input
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <FieldError />
          </TextField>
        </div>

        <TextField type="email" isRequired>
          <Label>Email Address</Label>
          <Input
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError />
        </TextField>

        <TextField isRequired>
          <Label>Password</Label>
          <Input
            type={isVisible ? "text" : "password"}
            endContent={
              <button type="button" onClick={() => setIsVisible(!isVisible)}>
                <Icon
                  className="text-text-tertiary text-xl"
                  icon={isVisible ? "solar:eye-closed-linear" : "solar:eye-bold"}
                />
              </button>
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FieldError />
        </TextField>

        <TextField isRequired>
          <Label>Confirm Password</Label>
          <Input
            type={isConfirmVisible ? "text" : "password"}
            endContent={
              <button type="button" onClick={() => setIsConfirmVisible(!isConfirmVisible)}>
                <Icon
                  className="text-text-tertiary text-xl"
                  icon={isConfirmVisible ? "solar:eye-closed-linear" : "solar:eye-bold"}
                />
              </button>
            }
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <FieldError />
        </TextField>

        <Checkbox isRequired isSelected={agreedToTerms} onChange={setAgreedToTerms} id="agree-terms">
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Content>
            <Label htmlFor="agree-terms" className="text-xs text-text-secondary leading-relaxed">
              I agree to the{" "}
              <a href="https://cuttr.com/terms" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:underline">Terms</a> and{" "}
              <a href="https://cuttr.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:underline">Privacy Policy</a>
            </Label>
          </Checkbox.Content>
        </Checkbox>

        <Button
          className="bg-accent-400 text-white font-semibold rounded-xl"
          size="lg"
          type="submit"
          isPending={isLoading}
        >
          Create Account
        </Button>
      </form>

      <div className="flex items-center gap-4 my-2">
        <Separator className="flex-1" />
        <span className="text-xs text-text-tertiary">OR</span>
        <Separator className="flex-1" />
      </div>

      <ContinueWithGoogle />

      <p className="text-sm text-center text-text-secondary mt-2">
        Already have an account?{" "}
        <button className="text-accent-400 font-medium hover:underline" onClick={onLogin}>
          Log In
        </button>
      </p>
    </>
  );
}
