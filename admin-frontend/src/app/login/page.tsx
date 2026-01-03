"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminAPI } from "@/lib/api";

type LoginStep = "credentials" | "verify2FA";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first code input when entering 2FA step
  useEffect(() => {
    if (step === "verify2FA" && codeInputRefs.current[0]) {
      codeInputRefs.current[0].focus();
    }
  }, [step]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await adminAPI.login(email, password);
      if (response.requires2FA) {
        setStep("verify2FA");
        setResendCooldown(60); // 60 second cooldown before allowing resend
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.slice(-1);
    if (digit && !/^\d$/.test(digit)) return;

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5 && newCode.every(c => c !== "")) {
      handleVerify2FA(newCode.join(""));
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      const newCode = pastedData.split("");
      setCode(newCode);
      handleVerify2FA(pastedData);
    }
  };

  const handleVerify2FA = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join("");
    if (codeToVerify.length !== 6) return;

    setError("");
    setIsLoading(true);

    try {
      const { token } = await adminAPI.verify2FA(email, codeToVerify);
      localStorage.setItem("admin_token", token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setCode(["", "", "", "", "", ""]);
      codeInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setError("");
    setIsLoading(true);

    try {
      await adminAPI.resend2FA(email, password);
      setResendCooldown(60);
      setCode(["", "", "", "", "", ""]);
      codeInputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStep("credentials");
    setCode(["", "", "", "", "", ""]);
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald/20 mb-4">
            <svg className="w-7 h-7 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Cuttr Admin</h1>
          <p className="text-text-secondary mt-1">
            {step === "credentials"
              ? "Enterprise management dashboard"
              : "Enter verification code"}
          </p>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary placeholder-text-muted transition-colors"
                placeholder="admin@cuttr.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary placeholder-text-muted transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-emerald hover:bg-emerald-dark text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald/20 hover:shadow-emerald/30"
            >
              {isLoading ? "Signing in..." : "Continue"}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="bg-surface rounded-2xl border border-border p-4">
              <p className="text-text-secondary text-sm text-center">
                We sent a 6-digit code to <span className="text-text-primary font-medium">contact@cuttr.com</span>
              </p>
              <p className="text-text-muted text-xs text-center mt-1">
                Code expires in 15 minutes
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3 text-center">
                Verification Code
              </label>
              <div className="flex gap-2 justify-center" onPaste={handleCodePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { codeInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl bg-surface border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary transition-colors"
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button
              onClick={() => handleVerify2FA()}
              disabled={isLoading || code.some(c => c === "")}
              className="w-full py-3 px-4 rounded-xl bg-emerald hover:bg-emerald-dark text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald/20 hover:shadow-emerald/30"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                "Verify Code"
              )}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                onClick={handleBackToLogin}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                ← Back to login
              </button>
              <button
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isLoading}
                className="text-emerald hover:text-emerald-light transition-colors disabled:text-text-muted disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-text-muted text-xs mt-8">
          Cuttr Enterprise Administration
        </p>
      </div>
    </div>
  );
}
