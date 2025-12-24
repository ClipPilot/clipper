"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authAPI } from "../../../api/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  console.log("Handling auth callback...");

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session?.access_token) {
        router.replace("/auth?error=google_failed");
        return;
      }

      // 🔁 Exchange Supabase → YOUR backend tokens
      await authAPI.signInWithSupabase(
        data.session.access_token,
        data.session.refresh_token
      );

      router.replace("/dashboard");
    };

    handleCallback();
  }, [router]);

  return <p>Signing you in…</p>;
}
