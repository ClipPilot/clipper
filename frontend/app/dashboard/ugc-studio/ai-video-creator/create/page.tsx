"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatInterface } from "@/components/ugc-studio/chat";
import { PageLoader } from "@/components/ui/PageLoader";

function CreateAdContent() {
  const searchParams = useSearchParams();
  const scriptId = searchParams.get("scriptId");

  return <ChatInterface resumeScriptId={scriptId} />;
}

export default function CreateAdPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CreateAdContent />
    </Suspense>
  );
}
