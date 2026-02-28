export function extractPostIdentifier(url: string, platform: string): string | null {
  try {
    const u = new URL(url);
    switch (platform) {
      case "instagram": {
        const match = u.pathname.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
        return match?.[1] ?? null;
      }
      case "tiktok": {
        const match = u.pathname.match(/\/video\/(\d+)/);
        return match?.[1] ?? null;
      }
      case "x": {
        const match = u.pathname.match(/\/status\/(\d+)/);
        return match?.[1] ?? null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
