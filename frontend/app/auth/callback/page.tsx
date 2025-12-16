"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { supabase } from "@/lib/supabase";

export default function CallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorDescription = hashParams.get("error_description");
        if (errorDescription) {
          setError(errorDescription);
          return;
        }

        // Let Supabase handle the session from the URL automatically
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          setError(sessionError.message);
          return;
        }

        // Check the type from URL hash
        const type = hashParams.get("type");

        if (type === "recovery" && data.session) {
          // User is authenticated for password recovery - redirect to change password page
          router.replace("/reset-password");
          return;
        }

        // For other auth flows, redirect to auth page
        router.replace("/auth");
      } catch (err: any) {
        console.error("Callback error:", err);
        setError(err.message || "An error occurred");
      }
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface-dark">
        <div className="flex flex-col items-center gap-4 p-8 max-w-md text-center">
          <div className="p-4 rounded-full bg-red-500/10">
            <Icon icon="solar:danger-triangle-bold-duotone" className="text-4xl text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">Authentication Error</h2>
          <p className="text-text-secondary">{error}</p>
          <button
            onClick={() => router.push("/auth")}
            className="mt-4 px-6 py-3 bg-accent-400 text-white font-semibold rounded-xl hover:bg-accent-500 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-surface-dark">
      <div className="flex flex-col items-center gap-4">
        <Icon
          icon="solar:loading-circle-bold"
          className="text-4xl animate-spin text-accent-400"
        />
        <p className="text-text-secondary">Processing...</p>
      </div>
    </div>
  );
}
