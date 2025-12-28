"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

interface Props {
  disabled?: boolean;
  processFile?: (file: File) => Promise<void>;
  multiple?: boolean;
  processFiles?: (files: File[]) => Promise<void>;
  setDownloading: (loading: boolean) => void;
  downloading?: boolean;
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY!;
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID!;
const SCOPES = "https://www.googleapis.com/auth/drive.file";

declare const google: any;
declare const gapi: any;

export function DrivePicker(props: Props) {
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const script1 = document.createElement("script");
    script1.src = "https://apis.google.com/js/api.js";
    script1.async = true;
    script1.defer = true;
    script1.onload = () => {
      gapi.load("picker", () => setGapiLoaded(true));
    };
    document.body.appendChild(script1);

    const script2 = document.createElement("script");
    script2.src = "https://accounts.google.com/gsi/client";
    script2.async = true;
    script2.defer = true;
    script2.onload = () => setGisLoaded(true);
    document.body.appendChild(script2);
  }, []);

  useEffect(() => {
    if (gisLoaded && !tokenClient) {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: "",
      });
      setTokenClient(client);
    }
  }, [gisLoaded, tokenClient]);

  const downloadFile = async (fileId: string, fileName: string, mimeType: string, token: string): Promise<File> => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    return new File([blob], fileName, { type: mimeType });
  };

  const createPicker = useCallback((token: string) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS_VIDEOS);
    view.setMode(google.picker.DocsViewMode.LIST);

    const builder = new google.picker.PickerBuilder()
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .setOAuthToken(token)
      .addView(view)
      .setCallback(async (data: any) => {
        if (data.action !== google.picker.Action.PICKED) return;

        props.setDownloading(true);
        try {
          const docs = data.docs || data[google.picker.Response.DOCUMENTS];

          if (props.processFiles) {
            const files = await Promise.all(
              docs.map((doc: any) => downloadFile(doc.id, doc.name, doc.mimeType, token))
            );
            await props.processFiles(files);
          } else if (props.processFile && docs.length > 0) {
            const doc = docs[0];
            const file = await downloadFile(doc.id, doc.name, doc.mimeType, token);
            await props.processFile(file);
          }
        } catch (err) {
          console.error("Error processing files:", err);
        } finally {
          props.setDownloading(false);
        }
      });

    if (props.multiple || props.processFiles) {
      builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
    }

    builder.build().setVisible(true);
  }, [props]);

  const handleClick = () => {
    if (!tokenClient) return;

    if (accessToken) {
      createPicker(accessToken);
      return;
    }

    tokenClient.callback = (response: any) => {
      if (response.error) {
        console.error("OAuth error:", response);
        return;
      }
      setAccessToken(response.access_token);
      createPicker(response.access_token);
    };

    tokenClient.requestAccessToken({ prompt: "consent" });
  };

  const isReady = gapiLoaded && gisLoaded && tokenClient;

  return (
    <Button
      size="md"
      variant="flat"
      color="secondary"
      isDisabled={props.disabled || props.downloading || !isReady}
      startContent={<Icon icon="logos:google-drive" />}
      onPress={handleClick}
    >
      Upload from Google Drive
    </Button>
  );
}
