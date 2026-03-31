"use client";

import React, { useState } from "react";
import {
  Button,
  Input,
  Separator,
  Checkbox,
  TextField,
  Label,
  FieldError,
  InputGroup,
} from "@heroui/react";
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
        <h2 className="text-2xl font-bold text-text-primary">Welcome Back</h2>
        <p className="text-sm text-text-secondary mt-1">Log in to your account</p>
      </div>

      {error && (
        <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <TextField fullWidth type="email" isRequired variant="secondary">
          <Label>Email Address</Label>
          <Input
            name="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError />
        </TextField>

        <TextField fullWidth isRequired variant="secondary">
          <Label>Password</Label>
          <InputGroup>
            <InputGroup.Input
              name="password"
              placeholder="Enter your password"
              type={isVisible ? "text" : "password"}
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            />
            <InputGroup.Suffix>
              <Button
                isIconOnly
                variant="tertiary"
                size="sm"
                onPress={() => setIsVisible(!isVisible)}
              >
                <Icon icon={isVisible ? "solar:eye-closed-linear" : "solar:eye-bold"} className="text-lg text-muted" />
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <FieldError />
        </TextField>

        <div className="flex items-center justify-between">
          <Checkbox isSelected={rememberMe} onChange={setRememberMe} id="remember-me">
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>
              <Label htmlFor="remember-me" className="text-sm text-text-secondary">Remember me</Label>
            </Checkbox.Content>
          </Checkbox>
          <span className="text-sm text-accent-400 font-medium hover:underline cursor-pointer" onClick={onForgotPassword}>
            Forgot Password?
          </span>
        </div>

        <Button
          className="w-full bg-accent-400 text-white font-semibold rounded-xl"
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
        <span className="text-accent-400 font-medium hover:underline cursor-pointer" onClick={onSignUp}>
          Sign Up
        </span>
      </p>
    </>
  );
}
