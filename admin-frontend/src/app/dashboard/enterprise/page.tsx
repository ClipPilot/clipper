"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { adminAPI, Team } from "@/lib/api";

function EnterpriseSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamId = searchParams.get("teamId");

  const [team, setTeam] = useState<Team | null>(null);
  const [clipLimit, setClipLimit] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ checkoutUrl: string } | null>(null);

  useEffect(() => {
    if (teamId) {
      loadTeam(teamId);
    } else {
      setIsLoadingTeam(false);
    }
  }, [teamId]);

  const loadTeam = async (id: string) => {
    try {
      const { team } = await adminAPI.getTeam(id);
      setTeam(team);
      setCustomerEmail(team.ownerEmail || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;

    setError("");
    setIsLoading(true);

    try {
      const response = await adminAPI.setupEnterprise(
        teamId,
        parseInt(clipLimit),
        Math.round(parseFloat(monthlyPrice) * 100),
        customerEmail
      );
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingTeam) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="text-center py-16">
        <svg className="w-12 h-12 mx-auto mb-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-text-tertiary mb-4">No team selected</p>
        <Link href="/dashboard" className="text-emerald hover:text-emerald-light transition-colors">
          Go back to teams
        </Link>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald/20 mb-4">
            <svg className="w-8 h-8 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Enterprise Setup Complete</h2>
          <p className="text-text-secondary">
            Share the checkout link with the customer to complete their subscription.
          </p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 shadow-lg shadow-black/20">
          <div>
            <label className="block text-sm font-medium text-text-tertiary mb-2">Checkout URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={result.checkoutUrl}
                readOnly
                className="flex-1 px-4 py-3 rounded-xl bg-surface-elevated border border-border text-text-primary text-sm font-mono"
              />
              <button
                onClick={() => navigator.clipboard.writeText(result.checkoutUrl)}
                className="px-4 py-3 rounded-xl bg-emerald/10 text-emerald hover:bg-emerald/20 border border-emerald/20 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <a
            href={result.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3 px-4 rounded-xl bg-emerald hover:bg-emerald-dark text-white font-semibold transition-all shadow-lg shadow-emerald/20"
          >
            Open Checkout
          </a>
        </div>

        <div className="text-center">
          <Link href="/dashboard" className="text-text-secondary hover:text-text-primary transition-colors">
            ← Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Teams
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Setup Enterprise</h1>
        <p className="text-text-secondary mt-1">Configure custom pricing for {team?.name}</p>
      </div>

      {team && (
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-lg shadow-black/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald/20 flex items-center justify-center">
              <span className="text-emerald font-bold text-xl">{team.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <div className="font-semibold text-text-primary text-lg">{team.name}</div>
              <div className="text-sm text-text-secondary">
                Current plan: <span className="text-text-tertiary">{team.plan}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-border p-6 space-y-5 shadow-lg shadow-black/20">
        <div>
          <label htmlFor="customerEmail" className="block text-sm font-medium text-text-secondary mb-2">
            Customer Email
          </label>
          <input
            id="customerEmail"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-elevated border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary transition-colors"
            required
          />
          <p className="text-xs text-text-muted mt-1.5">Email for Stripe customer billing</p>
        </div>

        <div>
          <label htmlFor="clipLimit" className="block text-sm font-medium text-text-secondary mb-2">
            Monthly Clip Limit
          </label>
          <input
            id="clipLimit"
            type="number"
            min="1"
            value={clipLimit}
            onChange={(e) => setClipLimit(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-elevated border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary transition-colors"
            placeholder="5000"
            required
          />
        </div>

        <div>
          <label htmlFor="monthlyPrice" className="block text-sm font-medium text-text-secondary mb-2">
            Monthly Price (USD)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">$</span>
            <input
              id="monthlyPrice"
              type="number"
              min="0.01"
              step="0.01"
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(e.target.value)}
              className="w-full pl-8 pr-4 py-3 rounded-xl bg-surface-elevated border border-border focus:border-emerald focus:ring-1 focus:ring-emerald outline-none text-text-primary transition-colors"
              placeholder="999.00"
              required
            />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 rounded-xl bg-emerald hover:bg-emerald-dark text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald/20 hover:shadow-emerald/30"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Setting up...
            </span>
          ) : (
            "Create Enterprise Subscription"
          )}
        </button>
      </form>
    </div>
  );
}

export default function EnterprisePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
      </div>
    }>
      <EnterpriseSetupContent />
    </Suspense>
  );
}
