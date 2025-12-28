"use client";

import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const loadGapi = () => {
      if (document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
        if (typeof gapi !== "undefined") {
          gapi.load("picker", () => setGapiLoaded(true));
        }
        return;
      }
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.defer = true;
      script.onload = () => gapi.load("picker", () => setGapiLoaded(true));
      document.body.appendChild(script);
    };

    const loadGis = () => {
      if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        if (typeof google !== "undefined" && google.accounts) {
          setGisLoaded(true);
        }
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => setGisLoaded(true);
      document.body.appendChild(script);
    };

    loadGapi();
    loadGis();
  }, []);

  useEffect(() => {
    if (gisLoaded && !tokenClient) {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: () => {},
      });
      setTokenClient(client);
    }
  }, [gisLoaded, tokenClient]);

  const downloadFile = async (fileId: string, fileName: string, mimeType: string, token: string): Promise<File> => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Download error:", res.status, errorText);
      throw new Error(`Download failed: ${res.status}`);
    }
    const blob = await res.blob();
    return new File([blob], fileName, { type: mimeType });
  };

  const handlePickerCallback = useCallback(async (data: any, token: string) => {
    console.log("Picker callback data:", data);

    if (data.action === "cancel" || data.action === google.picker.Action.CANCEL) {
      console.log("Picker cancelled");
      return;
    }

    if (data.action === "picked" || data.action === google.picker.Action.PICKED) {
      const docs = data.docs || data[google.picker.Response.DOCUMENTS] || [];
      console.log("Selected docs:", docs);

      if (docs.length === 0) {
        console.error("No documents in picker response");
        return;
      }

      props.setDownloading(true);
      try {
        if (props.processFiles) {
          const files = await Promise.all(
            docs.map((doc: any) => {
              console.log("Downloading:", doc.name, doc.id, doc.mimeType);
              return downloadFile(doc.id, doc.name, doc.mimeType, token);
            })
          );
          await props.processFiles(files);
        } else if (props.processFile) {
          const doc = docs[0];
          console.log("Downloading single file:", doc.name, doc.id, doc.mimeType);
          const file = await downloadFile(doc.id, doc.name, doc.mimeType, token);
          await props.processFile(file);
        }
      } catch (err) {
        console.error("Error processing files:", err);
      } finally {
        props.setDownloading(false);
      }
    }
  }, [props]);

  const createPicker = useCallback((token: string) => {
    console.log("Creating picker with token");

    const view = new google.picker.DocsView(google.picker.ViewId.DOCS_VIDEOS);
    view.setMode(google.picker.DocsViewMode.LIST);

    const builder = new google.picker.PickerBuilder()
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .setOAuthToken(token)
      .addView(view)
      .setCallback((data: any) => handlePickerCallback(data, token))
      .setOrigin(window.location.origin);

    if (props.multiple || props.processFiles) {
      builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
    }

    const picker = builder.build();
    picker.setVisible(true);
  }, [props.multiple, props.processFiles, handlePickerCallback]);

  const handleSignIn = () => {
    if (!tokenClient) return;

    setIsSigningIn(true);

    tokenClient.callback = (response: any) => {
      setIsSigningIn(false);
      if (response.error) {
        console.error("OAuth error:", response);
        return;
      }
      console.log("Got access token");
      setAccessToken(response.access_token);
      setIsModalOpen(false);
      createPicker(response.access_token);
    };

    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  };

  const handleButtonClick = () => {
    if (accessToken) {
      createPicker(accessToken);
    } else {
      setIsModalOpen(true);
    }
  };

  const isReady = gapiLoaded && gisLoaded && tokenClient;

  return (
    <>
      <Button
        size="md"
        variant="flat"
        color="secondary"
        isDisabled={props.disabled || props.downloading || !isReady}
        startContent={<Icon icon="logos:google-drive" />}
        onPress={handleButtonClick}
      >
        Upload from Google Drive
      </Button>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">Connect Google Drive</ModalHeader>
          <ModalBody>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center">
                <Icon icon="logos:google-drive" className="text-4xl" />
              </div>
              <p className="text-center text-text-secondary">
                Sign in with Google to select videos from your Drive
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSignIn}
              isLoading={isSigningIn}
              startContent={!isSigningIn && <Icon icon="flat-color-icons:google" />}
            >
              Sign in with Google
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
