import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/env", () => ({
  config: { sync: { apiKey: "test-sync-key" } },
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

import { SyncService } from "../sync.service";

describe("SyncService", () => {
  let service: SyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SyncService();
  });

  describe("isConfigured", () => {
    it("returns true when API key is set", () => {
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe("createLipSync", () => {
    it("sends correct request to Sync API", async () => {
      const jobResponse = { id: "job-1", status: "PENDING", outputUrl: null };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(jobResponse),
      });

      const result = await service.createLipSync(
        "https://s3.example.com/video.mp4",
        "https://s3.example.com/audio.wav"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.sync.so/v2/generate",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "test-sync-key",
          },
        })
      );
      expect(result).toEqual(jobResponse);
    });

    it("uses custom model and sync mode", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "job-2", status: "PENDING" }),
      });

      await service.createLipSync("v.mp4", "a.wav", {
        model: "lipsync-2-pro",
        syncMode: "bounce",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("lipsync-2-pro");
      expect(body.options.sync_mode).toBe("bounce");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad request"),
      });

      await expect(service.createLipSync("v.mp4", "a.wav")).rejects.toThrow(
        "Sync API error (400): Bad request"
      );
    });
  });

  describe("getStatus", () => {
    it("fetches job status", async () => {
      const statusResponse = { id: "job-1", status: "COMPLETED", outputUrl: "https://out.mp4" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(statusResponse),
      });

      const result = await service.getStatus("job-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.sync.so/v2/generate/job-1",
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual(statusResponse);
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      });

      await expect(service.getStatus("bad-id")).rejects.toThrow(
        "Sync API error (404): Not found"
      );
    });
  });

  describe("waitForCompletion", () => {
    it("returns immediately when status is COMPLETED", async () => {
      const completed = { id: "job-1", status: "COMPLETED", outputUrl: "https://out.mp4" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(completed),
      });

      const result = await service.waitForCompletion("job-1", { pollInterval: 10 });
      expect(result).toEqual(completed);
    });

    it("throws when job status is FAILED", async () => {
      const failed = { id: "job-1", status: "FAILED", error: "Processing error" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(failed),
      });

      await expect(
        service.waitForCompletion("job-1", { pollInterval: 10 })
      ).rejects.toThrow("Lip sync failed: Processing error");
    });

    it("throws when job status is REJECTED", async () => {
      const rejected = { id: "job-1", status: "REJECTED", error: null, error_code: "CONTENT_POLICY" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(rejected),
      });

      await expect(
        service.waitForCompletion("job-1", { pollInterval: 10 })
      ).rejects.toThrow("Lip sync rejected: CONTENT_POLICY");
    });

    it("calls onProgress when status changes", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        const status = callCount >= 2 ? "COMPLETED" : "PROCESSING";
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "job-1", status, outputUrl: callCount >= 2 ? "url" : null }),
        });
      });

      const onProgress = vi.fn();
      await service.waitForCompletion("job-1", { pollInterval: 10, onProgress });
      expect(onProgress).toHaveBeenCalledWith("PROCESSING");
      expect(onProgress).toHaveBeenCalledWith("COMPLETED");
    });

    it("times out after maxWaitTime", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "job-1", status: "PROCESSING" }),
      });

      await expect(
        service.waitForCompletion("job-1", { pollInterval: 10, maxWaitTime: 30 })
      ).rejects.toThrow("Lip sync timed out");
    });
  });

  describe("applyLipSync", () => {
    it("returns outputUrl on success", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: "job-1", status: "PENDING" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "job-1", status: "COMPLETED", outputUrl: "https://out.mp4" }),
        });
      });

      const result = await service.applyLipSync("v.mp4", "a.wav", { pollInterval: 10 });
      expect(result).toBe("https://out.mp4");
    });

    it("throws when completed but no outputUrl", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: "job-1", status: "PENDING" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "job-1", status: "COMPLETED", outputUrl: null }),
        });
      });

      await expect(
        service.applyLipSync("v.mp4", "a.wav", { pollInterval: 10 })
      ).rejects.toThrow("no output URL");
    });
  });

  describe("downloadOutput", () => {
    it("returns buffer from response", async () => {
      const fakeBuffer = new ArrayBuffer(4);
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(fakeBuffer),
      });

      const result = await service.downloadOutput("https://out.mp4");
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403 });

      await expect(service.downloadOutput("https://out.mp4")).rejects.toThrow(
        "Failed to download sync output: 403"
      );
    });
  });
});
