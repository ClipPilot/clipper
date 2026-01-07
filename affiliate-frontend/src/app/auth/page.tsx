"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Input, Button, Tabs, Tab } from "@heroui/react";
import { authAPI } from "@/api/auth";
import { affiliateAPI } from "@/api/affiliate";

export default function AuthPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState("login");

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await authAPI.signIn(loginData);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await authAPI.signUp(signupData);
      await affiliateAPI.becomeAffiliate();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-surface border border-border">
        <CardHeader className="flex flex-col gap-2 text-center pb-0">
          <div className="w-12 h-12 mx-auto rounded-xl bg-emerald/20 flex items-center justify-center mb-2">
            <svg
              className="w-6 h-6 text-emerald"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Cuttr Affiliate Portal</h1>
          <p className="text-text-secondary">Earn commission by referring brands</p>
        </CardHeader>
        <CardBody>
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            classNames={{
              tabList: "bg-surface-elevated",
              cursor: "bg-emerald/20",
              tab: "text-text-secondary data-[selected=true]:text-emerald",
            }}
          >
            <Tab key="login" title="Login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <Input
                  label="Email"
                  type="email"
                  value={loginData.email}
                  onValueChange={(v) => setLoginData({ ...loginData, email: v })}
                  required
                  classNames={{
                    input: "bg-surface-elevated",
                    inputWrapper: "bg-surface-elevated border-border",
                  }}
                />
                <Input
                  label="Password"
                  type="password"
                  value={loginData.password}
                  onValueChange={(v) => setLoginData({ ...loginData, password: v })}
                  required
                  classNames={{
                    input: "bg-surface-elevated",
                    inputWrapper: "bg-surface-elevated border-border",
                  }}
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <Button
                  type="submit"
                  className="w-full bg-emerald text-black font-medium"
                  isLoading={isLoading}
                >
                  Login
                </Button>
              </form>
            </Tab>
            <Tab key="signup" title="Sign Up">
              <form onSubmit={handleSignup} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={signupData.firstName}
                    onValueChange={(v) => setSignupData({ ...signupData, firstName: v })}
                    required
                    classNames={{
                      input: "bg-surface-elevated",
                      inputWrapper: "bg-surface-elevated border-border",
                    }}
                  />
                  <Input
                    label="Last Name"
                    value={signupData.lastName}
                    onValueChange={(v) => setSignupData({ ...signupData, lastName: v })}
                    required
                    classNames={{
                      input: "bg-surface-elevated",
                      inputWrapper: "bg-surface-elevated border-border",
                    }}
                  />
                </div>
                <Input
                  label="Email"
                  type="email"
                  value={signupData.email}
                  onValueChange={(v) => setSignupData({ ...signupData, email: v })}
                  required
                  classNames={{
                    input: "bg-surface-elevated",
                    inputWrapper: "bg-surface-elevated border-border",
                  }}
                />
                <Input
                  label="Password"
                  type="password"
                  value={signupData.password}
                  onValueChange={(v) => setSignupData({ ...signupData, password: v })}
                  required
                  classNames={{
                    input: "bg-surface-elevated",
                    inputWrapper: "bg-surface-elevated border-border",
                  }}
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <Button
                  type="submit"
                  className="w-full bg-emerald text-black font-medium"
                  isLoading={isLoading}
                >
                  Create Account
                </Button>
              </form>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
