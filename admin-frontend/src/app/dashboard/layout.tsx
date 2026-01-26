"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.push("/login");
      return;
    }
    setIsAuthenticated(true);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    router.push("/login");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-surface-elevated/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <span className="font-semibold text-text-primary">Cuttr Admin</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald/20 text-emerald font-medium">
                    Enterprise
                  </span>
                </div>
              </Link>
              <div className="hidden sm:flex items-center gap-1">
                <Link
                  href="/dashboard"
                  className="text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover px-3 py-2 rounded-lg transition-colors"
                >
                  Teams
                </Link>
                <Link
                  href="/dashboard/referrals"
                  className="text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover px-3 py-2 rounded-lg transition-colors"
                >
                  Referrals
                </Link>
                <Link
                  href="/dashboard/affiliates"
                  className="text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover px-3 py-2 rounded-lg transition-colors"
                >
                  Affiliates
                </Link>
                <Link
                  href="/dashboard/announcements"
                  className="text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover px-3 py-2 rounded-lg transition-colors"
                >
                  Announcements
                </Link>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover px-3 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
