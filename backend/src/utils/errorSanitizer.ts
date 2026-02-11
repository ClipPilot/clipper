const BLOCKLIST = [
  "Kling",
  "VEED",
  "Fabric",
  "FAL",
  "fal.ai",
  "ElevenLabs",
  "11labs",
  "Gemini",
  "OpenAI",
  "gpt-5",
  "gpt-4",
  "GPT",
  "Grok",
  "Sync.so",
  "Sentry",
  "Supabase",
  "Redis",
  "Drizzle",
  "SQS",
  "S3 ",
  "Lambda",
  "ECS",
  "Terraform",
];

/**
 * Strips proprietary service/infra names from error messages
 * before they reach the frontend via API responses, DB storage, or Socket.io.
 *
 * Always logs the full error server-side for debugging.
 */
export function sanitizeErrorForFrontend(
  error: unknown,
  fallback: string
): string {
  if (!error) return fallback;

  const raw =
    error instanceof Error ? error.message : String(error);

  const lower = raw.toLowerCase();
  const leaks = BLOCKLIST.some((term) =>
    lower.includes(term.toLowerCase())
  );

  if (leaks) {
    return fallback;
  }

  // Even without a blocklist hit, keep messages short and generic
  // to avoid leaking stack traces or internal paths
  if (raw.length > 120 || raw.includes("/") || raw.includes("\\")) {
    return fallback;
  }

  return raw;
}
