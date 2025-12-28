"use client";

import React, { useState } from "react";
import { Button, Input, Checkbox, Divider } from "@heroui/react";
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
        <h2 className="text-2xl font-bold text-text-primary">Create Account</h2>
        <p className="text-sm text-text-secondary mt-1">Sign up to get started</p>
      </div>

      {(error || localError) && (
        <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error || localError}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <Input
            isRequired
            label="First Name"
            placeholder="John"
            variant="flat"
            classNames={{
              inputWrapper:
                "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 rounded-xl",
            }}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            isRequired
            label="Last Name"
            placeholder="Doe"
            variant="flat"
            classNames={{
              inputWrapper:
                "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 rounded-xl",
            }}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <Input
          isRequired
          label="Email Address"
          placeholder="you@example.com"
          type="email"
          variant="flat"
          classNames={{
            inputWrapper:
              "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 rounded-xl",
          }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          isRequired
          label="Password"
          type={isVisible ? "text" : "password"}
          variant="flat"
          endContent={
            <button type="button" onClick={() => setIsVisible(!isVisible)}>
              <Icon
                className="text-text-tertiary text-xl"
                icon={isVisible ? "solar:eye-closed-linear" : "solar:eye-bold"}
              />
            </button>
          }
          classNames={{
            inputWrapper:
              "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 rounded-xl",
          }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Input
          isRequired
          label="Confirm Password"
          type={isConfirmVisible ? "text" : "password"}
          variant="flat"
          endContent={
            <button type="button" onClick={() => setIsConfirmVisible(!isConfirmVisible)}>
              <Icon
                className="text-text-tertiary text-xl"
                icon={isConfirmVisible ? "solar:eye-closed-linear" : "solar:eye-bold"}
              />
            </button>
          }
          classNames={{
            inputWrapper:
              "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 rounded-xl",
          }}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <div className="flex items-start gap-2">
          <Checkbox isRequired size="sm" isSelected={agreedToTerms} onValueChange={setAgreedToTerms} />
          <span className="text-xs text-text-secondary leading-relaxed">
            I agree to the{" "}
            <a href="https://cuttr.com/terms" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:underline">Terms</a> and{" "}
            <a href="https://cuttr.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:underline">Privacy Policy</a>
          </span>
        </div>

        <Button
          className="bg-accent-400 text-white font-semibold rounded-xl"
          size="lg"
          type="submit"
          isLoading={isLoading}
        >
          Create Account
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-2">
        <Divider className="flex-1" />
        <span className="text-xs text-text-tertiary">OR</span>
        <Divider className="flex-1" />
      </div>

      {/* Google Sign Up */}
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
