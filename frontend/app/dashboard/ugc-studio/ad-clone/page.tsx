"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/react";

export default function AdCloneRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/ugc-studio/ai-video-creator");
  }, [router]);

  return (
    <div className="min-h-screen bg-surface-dark flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
