export function parseInstagramUsername(input: string): string {
  let username = input.trim();

  if (username.startsWith("@")) {
    username = username.substring(1);
  }

  const urlMatch = username.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/
  );
  if (urlMatch) {
    username = urlMatch[1];
  }

  username = username.replace(/\/$/, "");
  return username;
}

export function parseTikTokUsername(input: string): string {
  let username = input.trim();

  if (username.startsWith("@")) {
    username = username.substring(1);
  }

  const urlMatch = username.match(
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/
  );
  if (urlMatch) {
    username = urlMatch[1];
  }

  username = username.replace(/\/$/, "");
  return username;
}

export function parseXUsername(input: string): string {
  let username = input.trim();

  if (username.startsWith("@")) {
    username = username.substring(1);
  }

  const urlMatch = username.match(
    /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/
  );
  if (urlMatch) {
    username = urlMatch[1];
  }

  username = username.replace(/\/$/, "");
  return username;
}
