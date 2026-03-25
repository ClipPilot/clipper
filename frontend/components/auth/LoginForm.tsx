"use client";

import React, { useState } from "react";
import { Button, Input, Separator, Checkbox, TextField, Label, FieldError } from "@heroui/react";
import { Icon } from "@iconify/react";
import ContinueWithGoogle from "./ContinueWithGoogle";

interface LoginFormProps {
  onSignUp: () => void;
  onForgotPassword: () => void;
  onSubmit: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  error: string;
  isLoading: boolean;
}

export default function LoginForm({
  onSignUp,
  onForgotPassword,
  onSubmit,
  error,
  isLoading,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(email, password, rememberMe);
  };

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-text-accent">Welcome Back</h2>
        <p className="text-sm text-text-secondary mt-1">
          Log in to your account
        </p>
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
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError />
        </TextField>

        <TextField isRequired>
          <Label>Password</Label>
          <Input
            endContent={
              <button type="button" onClick={() => setIsVisible(!isVisible)}>
                <Icon
                  className="text-text-tertiary text-xl"
                  icon={isVisible ? "solar:eye-closed-linear" : "solar:eye-bold"}
                />
              </button>
            }
            name="password"
            placeholder="Enter your password"
            type={isVisible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FieldError />
        </TextField>

        <div className="flex items-center justify-between -mt-2">
          <Checkbox isSelected={rememberMe} onChange={setRememberMe} id="remember-me">
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>
              <Label htmlFor="remember-me">Remember me</Label>
            </Checkbox.Content>
          </Checkbox>
          <button
            type="button"
            className="text-sm text-accent-400 font-medium hover:underline"
            onClick={onForgotPassword}
          >
            Forgot Password?
          </button>
        </div>

        <Button
          className="w-full bg-accent-400 text-white font-semibold mt-2 rounded-xl"
          type="submit"
          size="lg"
          isPending={isLoading}
        >
          Log In
        </Button>
      </form>

      <div className="flex items-center gap-4 my-2">
        <Separator className="flex-1" />
        <span className="text-xs text-text-tertiary">OR</span>
        <Separator className="flex-1" />
      </div>

      <ContinueWithGoogle />

      <p className="text-sm text-center text-text-secondary mt-2">
        Don&apos;t have an account?{" "}
        <button
          className="text-accent-400 font-medium hover:underline"
          onClick={onSignUp}
        >
          Sign Up
        </button>
      </p>
    </>
  );
}
