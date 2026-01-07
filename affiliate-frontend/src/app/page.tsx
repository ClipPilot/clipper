"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/api/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (authAPI.isAuthenticated()) {
      router.push("/dashboard");
    } else {
      router.push("/auth");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald border-t-transparent rounded-full" />
    </div>
  );
}
