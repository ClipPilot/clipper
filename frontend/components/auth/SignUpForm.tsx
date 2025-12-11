"use client";

import React, { useState } from "react";
import { Button, Input, Checkbox, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";

interface SignUpFormProps {
  onLogin: () => void;
  onSubmit: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  error: string;
  isLoading: boolean;
}

export default function SignUpForm({
  onLogin,
  onSubmit,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
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

      {error && (
        <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">First Name</label>
            <Input
              isRequired
              name="firstName"
              placeholder="John"
              type="text"
              variant="flat"
              classNames={{
                inputWrapper: "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 shadow-none rounded-xl",
                input: "text-text-primary placeholder:text-text-tertiary",
                innerWrapper: "shadow-none",
              }}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Last Name</label>
            <Input
              isRequired
              name="lastName"
              placeholder="Doe"
              type="text"
              variant="flat"
              classNames={{
                inputWrapper: "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 shadow-none rounded-xl",
                input: "text-text-primary placeholder:text-text-tertiary",
                innerWrapper: "shadow-none",
              }}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">Email Address</label>
          <Input
            isRequired
            name="email"
            placeholder="you@example.com"
            type="email"
            variant="flat"
            classNames={{
              inputWrapper: "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 shadow-none",
              input: "text-text-primary placeholder:text-text-tertiary",
              innerWrapper: "shadow-none",
            }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">Password</label>
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
            name="password"
            placeholder="Enter your password"
            type={isVisible ? "text" : "password"}
            variant="flat"
            classNames={{
              inputWrapper: "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 shadow-none",
              input: "text-text-primary placeholder:text-text-tertiary",
              innerWrapper: "shadow-none",
            }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            name="confirmPassword"
            placeholder="Confirm your password"
            type={isConfirmVisible ? "text" : "password"}
            variant="flat"
            classNames={{
              inputWrapper: "bg-surface-elevated border-2 border-border-base data-[hover=true]:border-border-light data-[focus=true]:border-accent-400 shadow-none",
              input: "text-text-primary placeholder:text-text-tertiary",
              innerWrapper: "shadow-none",
            }}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            isRequired
            size="sm"
            isSelected={agreedToTerms}
            onValueChange={setAgreedToTerms}
          />
          <span className="text-xs text-text-secondary leading-relaxed">
            I agree to the{" "}
            <button className="text-accent-400 hover:underline" type="button">
              Terms
            </button>{" "}
            and{" "}
            <button className="text-accent-400 hover:underline" type="button">
              Privacy Policy
            </button>
          </span>
        </div>

        <Button className="bg-accent-400 text-white font-semibold mt-2 rounded-xl" type="submit" size="lg" isLoading={isLoading}>
          Create Account
        </Button>
      </form>

      <div className="flex items-center gap-4">
        <Divider className="flex-1 bg-border-base" />
        <span className="text-xs text-text-tertiary">OR</span>
        <Divider className="flex-1 bg-border-base" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="p-3 border-2 border-border-base rounded-xl bg-surface-elevated/50 hover:border-accent-400 transition-colors">
          <Button startContent={<Icon icon="flat-color-icons:google" width={20} />} variant="light" size="lg" className="w-full rounded-xl">
            <span className="text-text-primary font-medium">Continue with Google</span>
          </Button>
        </div>
        <div className="p-3 border-2 border-border-base rounded-xl bg-surface-elevated/50 hover:border-accent-400 transition-colors">
          <Button startContent={<Icon icon="fe:github" width={20} className="text-text-primary" />} variant="light" size="lg" className="w-full rounded-xl">
            <span className="text-text-primary font-medium">Continue with Github</span>
          </Button>
        </div>
      </div>

      <p className="text-sm text-center text-text-secondary">
        Already have an account?{" "}
        <button className="text-accent-400 font-medium hover:underline" onClick={onLogin}>
          Log In
        </button>
      </p>
    </>
  );
}
