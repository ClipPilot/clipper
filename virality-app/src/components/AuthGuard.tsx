"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth";
import { authAPI } from "@/api/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAtomValue(userAtom);
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (user) {
      setIsChecking(false);
      return;
    }

    if (!authAPI.isAuthenticated()) {
      router.replace("/auth");
      return;
    }

    const timer = setTimeout(() => {
      if (!user) {
        setIsChecking(false);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [user, router]);

  if (isChecking && !user) {
    return (
      <div className="flex items-center w-full justify-center min-h-screen bg-background">
        <div className="w-6 h-6 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
