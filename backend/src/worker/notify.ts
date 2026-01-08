import * as Sentry from "@sentry/node";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

async function callNotifyEndpoint(endpoint: string, body: object): Promise<void> {
  if (!API_INTERNAL_URL) {
    console.log(`[NOTIFY] API_INTERNAL_URL not set, skipping notification`);
    return;
  }

  try {
    const response = await fetch(`${API_INTERNAL_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": INTERNAL_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn(`[NOTIFY] Failed to notify API: ${response.status}`);
    }
  } catch (error) {
    console.warn("[NOTIFY] Failed to notify API:", error);
    Sentry.captureException(error);
  }
}

export async function notifyClipsRefresh(teamId: number): Promise<void> {
  console.log(`[NOTIFY] Clips refresh for team ${teamId}`);
  await callNotifyEndpoint("/internal/notify/clips-refresh", { teamId });
}

export async function notifyClipUpdate(teamId: number, clipId: number): Promise<void> {
  console.log(`[NOTIFY] Clip ${clipId} updated for team ${teamId}`);
  await callNotifyEndpoint("/internal/notify/clip-update", { teamId, clipId });
}
