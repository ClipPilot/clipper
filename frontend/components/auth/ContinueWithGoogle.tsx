import { supabase } from "@/lib/supabase";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function ContinueWithGoogle() {
  return (
    <Button
      variant="bordered"
      size="lg"
      className="rounded-xl border-border-base hover:border-accent-400"
      startContent={<Icon icon="flat-color-icons:google" width={22} />}
      onPress={async () => {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/google-callback`,
          },
        });
      }}
    >
      Continue with Google
    </Button>
  );
}
