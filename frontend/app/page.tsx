"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user has access token
    const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    if (accessToken) {
      router.push("/dashboard");
    } else {
      router.push("/auth");
    }
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-surface-dark">
      <div className="flex flex-col items-center gap-4">
        <Icon icon="solar:loading-circle-bold" className="text-4xl animate-spin text-accent-400" />
        <p className="text-text-secondary">Loading...</p>
      </div>
    </div>
  );
}
