// Service Worker: intercepts /__video__/* requests and adds Authorization header
// so <video src="/__video__/..."> gets native browser streaming with auth.

let authToken = null;
let apiUrl = "";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "VIDEO_PROXY_CONFIG") {
    authToken = event.data.token;
    apiUrl = event.data.apiUrl;
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ status: "ok" });
    }
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (!url.pathname.startsWith("/__video__/")) return;

  if (!authToken || !apiUrl) {
    event.respondWith(new Response("Not configured", { status: 503 }));
    return;
  }

  const backendPath = url.pathname.slice("/__video__/".length);
  const backendUrl = `${apiUrl}/${backendPath}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${authToken}`);

  const range = event.request.headers.get("Range");
  if (range) {
    headers.set("Range", range);
  }

  event.respondWith(
    fetch(backendUrl, { headers, mode: "cors" }).catch(() => {
      return new Response("Video proxy error", { status: 502 });
    })
  );
});
