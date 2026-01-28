"use client";

let swReady = false;

export async function registerVideoServiceWorker(): Promise<boolean> {
  if (swReady) return true;
  if (typeof window === "undefined" || !("serviceWorker" in navigator))
    return false;

  try {
    const reg = await navigator.serviceWorker.register("/video-sw.js");

    const sw = reg.active || reg.installing || reg.waiting;
    if (!sw) return false;

    if (sw.state === "activated") {
      swReady = true;
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const onStateChange = () => {
        if (sw.state === "activated") {
          swReady = true;
          sw.removeEventListener("statechange", onStateChange);
          resolve(true);
        }
      };
      sw.addEventListener("statechange", onStateChange);
      setTimeout(() => resolve(false), 5000);
    });
  } catch (err) {
    console.warn("Failed to register video service worker:", err);
    return false;
  }
}

export async function configureVideoProxy(
  token: string,
  apiUrl: string
): Promise<boolean> {
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return false;

  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve(true);
    setTimeout(() => resolve(false), 2000);

    sw.postMessage({ type: "VIDEO_PROXY_CONFIG", token, apiUrl }, [
      channel.port2,
    ]);
  });
}

export function isVideoProxyReady(): boolean {
  return (
    swReady &&
    typeof navigator !== "undefined" &&
    !!navigator.serviceWorker?.controller
  );
}

export function getVideoProxyUrl(path: string): string {
  return `/__video__/${path}`;
}
