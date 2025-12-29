"use client";

import { supabase } from "@/lib/supabase";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Props {
  disabled?: boolean;
  processFile?: (file: File) => Promise<void>;
  multiple?: boolean;
  processFiles?: (files: File[]) => Promise<void>;
  setDownloading: (loading: boolean) => void;
  downloading?: boolean;
}

export function DrivePicker(props: Props) {
  const loadGooglePicker = () =>
    new Promise<void>((resolve, reject) => {
      if (window.google?.picker) return resolve();

      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.onload = () => window.gapi.load("picker", resolve);
      script.onerror = reject;
      document.body.appendChild(script);
    });

  const connectGoogleWithDrive = async () => {
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

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
      window.open(
        data.url,
        "Google Drive Authorization",
        `width=${width},height=${height},left=${left},top=${top}`
      );
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
    let picker;

    if (!props.processFiles) {
      picker = new window.google.picker.PickerBuilder()
        .addView(window.google.picker.ViewId.DOCS_VIDEOS)
        .setOAuthToken(token)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY!)
        .setCallback(async (data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const pickedFile = data.docs[0];

            props.setDownloading(true);

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

            props.setDownloading(false);

            if (props.processFile) await props.processFile(file);
          }
        })
        .build();
    } else {
      picker = new window.google.picker.PickerBuilder()
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .addView(window.google.picker.ViewId.DOCS_VIDEOS)
        .setOAuthToken(token)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY!)
        .setCallback(async (data: any) => {
          if (data.action !== window.google.picker.Action.PICKED) return;

          props.setDownloading(true);
          // Download ALL selected files
          const files: File[] = await Promise.all(
            data.docs.map(async (pickedFile: any) => {
              const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${pickedFile.id}?alt=media`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              const blob = await response.blob();
              return new File([blob], pickedFile.name, {
                type: pickedFile.mimeType,
              });
            })
          );
          props.setDownloading(false);

          if (props.processFiles) {
            await props.processFiles(files);
          }
        })
        .build();
    }

    picker.setVisible(true);
  };

  const handleGDrive = async () => {
    await loadGooglePicker();

    const { data } = await supabase.auth.getSession();
    const token = data.session?.provider_token;

    if (!token) {
      await connectGoogleWithDrive();
      return;
    }

    const hasDrive = await hasDriveAccess(token);
    if (!hasDrive) {
      await connectGoogleWithDrive();
      return;
    }

    await openPicker(token);
  };

  if (props.disabled) {
    return (
      <Button
        size="md"
        color="secondary"
        startContent={<Icon icon="logos:google-drive" />}
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
      isDisabled={props.downloading}
      startContent={<Icon icon="logos:google-drive" />}
      onPress={handleGDrive}
    >
      Upload from Google Drive
    </Button>
  );
}
