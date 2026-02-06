import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "../fetchWithTimeout";

describe("fetchWithTimeout", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the response on success", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout("https://example.com", {}, 5000);

    expect(result).toBe(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("passes options through to fetch", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok"));

    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: 1 }),
    };

    await fetchWithTimeout("https://api.test", options, 5000);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: 1 }),
      })
    );
  });

  it("aborts when timeout is reached", async () => {
    // Capture the signal to verify it's aborted
    let capturedSignal: AbortSignal | null = null;
    globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
      capturedSignal = opts.signal;
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    // Use a very short timeout so the test runs fast
    await expect(
      fetchWithTimeout("https://slow.com", {}, 10)
    ).rejects.toThrow(/aborted/i);

    expect(capturedSignal!.aborted).toBe(true);
  });

  it("clears the timeout after successful fetch", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok"));

    await fetchWithTimeout("https://fast.com", {}, 5000);

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("clears the timeout even when fetch fails", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(
      fetchWithTimeout("https://fail.com", {}, 5000)
    ).rejects.toThrow("Network error");

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
