"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface Props {
  disabled?: boolean;
}

export function DrivePicker(props: Props) {
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoogleToken = () => {
      // Check localStorage for the Drive token first
      const driveToken = localStorage.getItem("google_drive_token");

      if (driveToken) {
        console.log("Google Drive Token from localStorage:", driveToken);
        setGoogleToken(driveToken);
      }
    };

    fetchGoogleToken();

    // Listen for updates when Drive is connected
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "google_drive_token" && e.newValue) {
        setGoogleToken(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
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
      const checkToken = setInterval(() => {
        const token = localStorage.getItem("google_drive_token");
        if (token) {
          setGoogleToken(token);
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
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const file = data.docs[0];
          console.log("Picked Drive file:", file);
          // next step: download → upload (you already know this part)
        }
      })
      .build();

    picker.setVisible(true);
  };

  const handleGDrive = async () => {
    await loadGooglePicker();

    if (!googleToken) {
      connectGoogleWithDrive();
      return;
    }

    const hasDrive = await hasDriveAccess(googleToken);

    if (!hasDrive) {
      await connectGoogleWithDrive();
      return;
    }

    await openPicker(googleToken);
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
