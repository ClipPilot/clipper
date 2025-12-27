"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function DriveCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();

      // If OAuth failed or no Google token, abort
      if (error || !data.session?.provider_token) {
        if (window.opener) {
          window.close();
        } else {
          router.replace("/dashboard/create-clip?error=drive_failed");
        }
        return;
      }

      // OAuth succeeded — Supabase now holds the token
      if (window.opener) {
        window.close();
      } else {
        router.replace("/dashboard/create-clip");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dark">
      <Card className="bg-surface-base border border-border-base max-w-sm w-full">
        <CardBody className="flex flex-col items-center gap-4 py-10">
          <div className="w-14 h-14 rounded-2xl bg-accent-400/10 flex items-center justify-center">
            <Icon icon="logos:google-drive" width={32} />
          </div>

          <Spinner size="lg" color="primary" />

          <div className="text-center space-y-1">
            <p className="text-lg font-semibold text-text-primary">
              Connecting Google Drive
            </p>
            <p className="text-sm text-text-secondary animate-pulse">
              Finishing authentication…
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
