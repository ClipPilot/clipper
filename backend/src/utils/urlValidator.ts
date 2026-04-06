import { URL } from "url";
import dns from "dns/promises";
import net from "net";

const ALLOWED_SCHEMES = ["http:", "https:"];

const PRIVATE_IP_RANGES = [
  { start: "0.0.0.0", end: "0.255.255.255" },
  { start: "10.0.0.0", end: "10.255.255.255" },
  { start: "100.64.0.0", end: "100.127.255.255" },
  { start: "127.0.0.0", end: "127.255.255.255" },
  { start: "169.254.0.0", end: "169.254.255.255" },
  { start: "172.16.0.0", end: "172.31.255.255" },
  { start: "192.0.0.0", end: "192.0.0.255" },
  { start: "192.168.0.0", end: "192.168.255.255" },
  { start: "198.18.0.0", end: "198.19.255.255" },
];

function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;
  const ipInt = ipToInt(ip);
  return PRIVATE_IP_RANGES.some(
    (range) => ipInt >= ipToInt(range.start) && ipInt <= ipToInt(range.end),
  );
}

function expandIPv6MappedIPv4(ip: string): string | null {
  const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (dotted) return dotted[1];
  const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hex) {
    const high = parseInt(hex[1], 16);
    const low = parseInt(hex[2], 16);
    return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
  }
  return null;
}

function isPrivateIPv6(ip: string): boolean {
  if (!net.isIPv6(ip)) return false;
  if (ip === "::1") return true;
  if (ip.startsWith("fe80:")) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  const mappedIpv4 = expandIPv6MappedIPv4(ip);
  if (mappedIpv4) return isPrivateIPv4(mappedIpv4);
  return false;
}

function isPrivateIP(ip: string): boolean {
  return isPrivateIPv4(ip) || isPrivateIPv6(ip);
}

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

export async function validateUserUrl(
  url: string,
  options?: { allowedHostnames?: string[] },
): Promise<UrlValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return { valid: false, error: `Scheme '${parsed.protocol}' is not allowed. Only http and https are permitted.` };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs with credentials are not allowed" };
  }

  const rawHostname = parsed.hostname;
  const hostname = rawHostname.startsWith("[") && rawHostname.endsWith("]")
    ? rawHostname.slice(1, -1)
    : rawHostname;

  if (options?.allowedHostnames) {
    const allowed = options.allowedHostnames.some(
      (h) => hostname === h || hostname.endsWith("." + h),
    );
    if (!allowed) {
      return { valid: false, error: `Hostname '${hostname}' is not in the allowlist` };
    }
  }

  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      return { valid: false, error: "URLs pointing to private/internal IP addresses are not allowed" };
    }
    return { valid: true };
  }

  try {
    const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
    const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    const allAddresses = [...addresses, ...addresses6];

    if (allAddresses.length === 0) {
      return { valid: false, error: `Could not resolve hostname '${hostname}'` };
    }

    for (const addr of allAddresses) {
      if (isPrivateIP(addr)) {
        return { valid: false, error: "URLs pointing to private/internal IP addresses are not allowed" };
      }
    }
  } catch {
    return { valid: false, error: `Could not resolve hostname '${hostname}'` };
  }

  return { valid: true };
}

export function validateUserUrlSync(url: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return { valid: false, error: `Scheme '${parsed.protocol}' is not allowed. Only http and https are permitted.` };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs with credentials are not allowed" };
  }

  const hostname = parsed.hostname;

  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      return { valid: false, error: "URLs pointing to private/internal IP addresses are not allowed" };
    }
  }

  return { valid: true };
}

export function isValidHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{3,8}$/.test(value);
}

export function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}
