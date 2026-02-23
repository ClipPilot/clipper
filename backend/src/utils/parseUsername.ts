/**
 * Generic social-username parser.
 *
 * Strips a leading "@", then tries to extract a username from a profile URL
 * using the provided regex pattern (first capture group). Finally removes any
 * trailing slash and returns the cleaned username.
 */
export function parseSocialUsername(input: string, urlPattern: RegExp): string {
  let username = input.trim();

  if (username.startsWith("@")) {
    username = username.substring(1);
  }

  const urlMatch = username.match(urlPattern);
  if (urlMatch) {
    username = urlMatch[1];
  }

  username = username.replace(/\/$/, "");
  return username;
}

export function parseInstagramUsername(input: string): string {
  return parseSocialUsername(
    input,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/
  );
}

export function parseTikTokUsername(input: string): string {
  return parseSocialUsername(
    input,
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/
  );
}

export function parseXUsername(input: string): string {
  return parseSocialUsername(
    input,
    /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/
  );
}
