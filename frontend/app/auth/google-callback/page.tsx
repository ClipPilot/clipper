"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authAPI } from "../../../api/auth";
import { Card, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session?.access_token) {
        router.replace("/auth?error=google_failed");
        return;
      }

      await authAPI.signInWithSupabase(
        data.session.access_token,
        data.session.refresh_token
      );

      router.replace("/dashboard");
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dark">
      <Card className="bg-surface-base border border-border-base max-w-sm w-full">
        <Card.Content className="flex flex-col items-center gap-4 py-10">
          {/* Brand icon */}
          <div className="w-14 h-14 rounded-2xl bg-accent-400/10 flex items-center justify-center">
            <Icon
              icon="solar:lock-keyhole-bold-duotone"
              className="text-accent-400"
              width={32}
            />
          </div>

          {/* Spinner */}
          <Spinner size="lg" color="accent" />

          {/* Text */}
          <div className="text-center space-y-1">
            <p className="text-lg font-semibold text-text-accent">
              Signing you in
            </p>
            <p className="text-sm text-text-secondary animate-pulse">
              Finishing Google authentication…
            </p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
