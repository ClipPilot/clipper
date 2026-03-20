"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@heroui/react";
import { ChatInterface } from "@/components/ugc-studio/chat";

function CreateAdContent() {
  const searchParams = useSearchParams();
  const scriptId = searchParams.get("scriptId");

  return <ChatInterface resumeScriptId={scriptId} />;
}

export default function CreateAdPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-dark flex items-center justify-center">
          <Spinner size="lg" color="primary" />
        </div>
      }
    >
      <CreateAdContent />
    </Suspense>
  );
}
