"use client";

import { Suspense } from "react";
import { Spinner } from "@heroui/react";
import { ChatInterface } from "@/components/ugc-studio/chat";

export default function CreateAdPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-dark flex items-center justify-center">
          <Spinner size="lg" color="primary" />
        </div>
      }
    >
      <ChatInterface />
    </Suspense>
  );
}
