"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

type Props =
  | {
      disabled: true;
      processFile?: never;
    }
  | {
      disabled?: false;
      processFile: (file: File) => Promise<void>;
    };

export function DrivePicker(props: Props) {
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  useEffect(() => {
    const fetchGoogleToken = async () => {
      // Check if Drive was connected
      const driveConnected = localStorage.getItem("google_drive_connected");

      if (driveConnected) {
        // Get the token from Supabase session
        const { data } = await supabase.auth.getSession();

        if (data.session?.provider_token) {
          console.log("Google Drive Token from Supabase session");
          setGoogleToken(data.session.provider_token);
          setIsDriveConnected(true);
        } else {
          // Token expired or session lost, clear the flag
          localStorage.removeItem("google_drive_connected");
          setIsDriveConnected(false);
        }
      }
    };

    fetchGoogleToken();

    // Listen for auth state changes (token refresh, etc.)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (localStorage.getItem("google_drive_connected")) {
          if (session?.provider_token) {
            setGoogleToken(session.provider_token);
            setIsDriveConnected(true);
          } else {
            setGoogleToken(null);
            setIsDriveConnected(false);
            localStorage.removeItem("google_drive_connected");
          }
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadGooglePicker = () =>
    new Promise<void>((resolve, reject) => {
      if (window.google?.picker) return resolve();

      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.onload = () => {
        window.gapi.load("picker", resolve);
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });

  const connectGoogleWithDrive = async () => {
    // Open OAuth in a popup to avoid disrupting the current session
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Generate OAuth URL manually
    const { data } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/drive-callback`,
        scopes: "https://www.googleapis.com/auth/drive.readonly",
        queryParams: {
          prompt: "consent",
          access_type: "offline",
        },
        skipBrowserRedirect: true,
      },
    });

    if (data?.url) {
      // Open in popup to prevent session override
      const popup = window.open(
        data.url,
        "Google Drive Authorization",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for the Drive connection success
      const checkToken = setInterval(async () => {
        const token = localStorage.getItem("google_drive_token");
        if (token) {
          // Clean up the temporary token
          localStorage.removeItem("google_drive_token");

          // Set the connected state
          setIsDriveConnected(true);

          // Get fresh token from session
          const { data } = await supabase.auth.getSession();
          if (data.session?.provider_token) {
            setGoogleToken(data.session.provider_token);
          }

          clearInterval(checkToken);
          popup?.close();
        }
      }, 500);

      // Clean up interval if popup is closed
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkToken);
          clearInterval(checkPopup);
        }
      }, 500);
    }
  };

  const hasDriveAccess = async (token: string) => {
    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files?pageSize=1",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return res.ok;
  };

  const openPicker = async (token: string) => {
    await loadGooglePicker();

    const picker = new window.google.picker.PickerBuilder()
      .addView(window.google.picker.ViewId.DOCS_VIDEOS)
      .setOAuthToken(token)
      .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY!)
      .setCallback(async (data: any) => {
        if (!props.processFile) return;

        if (data.action === window.google.picker.Action.PICKED) {
          const pickedFile = data.docs[0];
          console.log("Picked Drive file:", pickedFile);

          // Download the file from Google Drive
          const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${pickedFile.id}?alt=media`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          const blob = await response.blob();
          const file = new File([blob], pickedFile.name, {
            type: pickedFile.mimeType,
          });

          await props.processFile(file);
        }
      })
      .build();

    picker.setVisible(true);
  };

  const handleGDrive = async () => {
    await loadGooglePicker();

    // Get fresh token from Supabase session (handles auto-refresh)
    const { data } = await supabase.auth.getSession();
    const currentToken = data.session?.provider_token;

    if (!currentToken || !isDriveConnected) {
      connectGoogleWithDrive();
      return;
    }

    // Update local state with fresh token
    setGoogleToken(currentToken);

    const hasDrive = await hasDriveAccess(currentToken);

    if (!hasDrive) {
      // Token might be invalid, clear connection and reconnect
      localStorage.removeItem("google_drive_connected");
      setIsDriveConnected(false);
      await connectGoogleWithDrive();
      return;
    }

    await openPicker(currentToken);
  };

  if (props.disabled) {
    return (
      <Button
        size="md"
        color="secondary"
        isDisabled
        startContent={<Icon icon="logos:google-drive" />}
        className="opacity-50 cursor-not-allowed"
      >
        Upload from Google Drive
      </Button>
    );
  }

  return (
    <Button
      size="md"
      variant="flat"
      color="secondary"
      startContent={<Icon icon="logos:google-drive" />}
      onPress={handleGDrive}
    >
      {googleToken ? "Upload from Google Drive" : "Connect Google Drive"}
    </Button>
  );
}
