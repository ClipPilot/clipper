"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { authAPI } from "@/api/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "solar:home-2-bold" },
  { href: "/dashboard/brands", label: "Brands", icon: "solar:buildings-bold" },
  { href: "/dashboard/payouts", label: "Payouts", icon: "solar:wallet-money-bold" },
  { href: "/dashboard/settings", label: "Settings", icon: "solar:settings-bold" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!authAPI.isAuthenticated()) {
      router.push("/auth");
      return;
    }
    setIsAuthenticated(true);
  }, [router]);

  const handleLogout = async () => {
    await authAPI.signOut();
    router.push("/auth");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 border-r border-border bg-surface-elevated p-4 flex flex-col">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-emerald"
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
            <span className="font-semibold text-text-primary">Cuttr Affiliates</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname === item.href
                  ? "bg-emerald/10 text-emerald"
                  : "text-text-secondary hover:bg-surface-hover"
              }`}
            >
              <Icon icon={item.icon} className="text-xl" />
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:bg-surface-hover transition-colors"
        >
          <Icon icon="solar:logout-2-bold" className="text-xl" />
          Logout
        </button>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
