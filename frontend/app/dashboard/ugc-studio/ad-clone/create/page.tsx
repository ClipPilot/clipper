"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/PageLoader";

export default function AdCloneCreateRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/ugc-studio/ai-video-creator/create");
  }, [router]);

  return <PageLoader />;
}
