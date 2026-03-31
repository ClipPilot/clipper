import { supabase } from "@/lib/supabase";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function ContinueWithGoogle() {
  return (
    <Button
 variant="outline"
 size="lg"
 className="w-full rounded-xl border-border-base hover:border-accent-400"
 onPress={async () => {
 await supabase.auth.signInWithOAuth({
 provider: "google",
 options: {
 redirectTo: `${window.location.origin}/auth/google-callback`,
 },
 });
 }}
 >
      <Icon icon="flat-color-icons:google" width={22} />
      Continue with Google
    </Button>
  );
}
