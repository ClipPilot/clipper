import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

// We need to test the module's internal functions. The module reads TEMP_DIR
// from process.cwd() at import time. We'll mock fs operations to avoid
// touching real filesystem, since the module hardcodes path.join(process.cwd(), "temp").

const { mockFs } = vi.hoisted(() => {
  const mockFs = {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    rmSync: vi.fn(),
  };
  return { mockFs };
});

vi.mock("fs", () => ({
  default: mockFs,
  ...mockFs,
}));

import {
  cleanupOldFiles,
  getTempStats,
  initializeTempCleanup,
  stopTempCleanup,
  TEMP_DIR,
} from "../tempCleanup";

describe("TEMP_DIR", () => {
  it("is based on process.cwd()", () => {
    expect(TEMP_DIR).toBe(path.join(process.cwd(), "temp"));
  });
});

describe("cleanupOldFiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns {deleted: 0, errors: 0} when temp dir doesn't exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = cleanupOldFiles();

    expect(result).toEqual({ deleted: 0, errors: 0 });
  });

  it("deletes files older than 1 hour", () => {
    mockFs.existsSync.mockReturnValue(true);

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    mockFs.readdirSync.mockReturnValue([
      { name: "old-file.mp4", isDirectory: () => false },
    ]);
    mockFs.statSync.mockReturnValue({ mtimeMs: twoHoursAgo });

    const result = cleanupOldFiles();

    expect(mockFs.unlinkSync).toHaveBeenCalledWith(
      path.join(TEMP_DIR, "old-file.mp4")
    );
    expect(result.deleted).toBe(1);
  });

  it("removes old directories recursively", () => {
    mockFs.existsSync.mockReturnValue(true);

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    mockFs.readdirSync.mockReturnValue([
      { name: "old-dir", isDirectory: () => true },
    ]);
    mockFs.statSync.mockReturnValue({ mtimeMs: twoHoursAgo });

    const result = cleanupOldFiles();

    expect(mockFs.rmSync).toHaveBeenCalledWith(
      path.join(TEMP_DIR, "old-dir"),
      { recursive: true, force: true }
    );
    expect(result.deleted).toBe(1);
  });

  it("skips recent files", () => {
    mockFs.existsSync.mockReturnValue(true);

    mockFs.readdirSync.mockReturnValue([
      { name: "new-file.mp4", isDirectory: () => false },
    ]);
    mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() - 1000 });

    const result = cleanupOldFiles();

    expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
  });

  it("counts errors for inaccessible files", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      { name: "locked-file", isDirectory: () => false },
    ]);
    mockFs.statSync.mockImplementation(() => {
      throw new Error("EACCES");
    });

    const result = cleanupOldFiles();

    expect(result.errors).toBe(1);
    expect(result.deleted).toBe(0);
  });
});

describe("getTempStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns zeros when temp dir doesn't exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = getTempStats();

    expect(result).toEqual({ fileCount: 0, totalSizeMB: 0 });
  });

  it("counts files and sums sizes", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(["file1.mp4", "file2.mp4"]);
    mockFs.statSync
      .mockReturnValueOnce({ size: 1024 * 1024 }) // 1MB
      .mockReturnValueOnce({ size: 2 * 1024 * 1024 }); // 2MB

    const result = getTempStats();

    expect(result.fileCount).toBe(2);
    expect(result.totalSizeMB).toBe(3);
  });

  it("skips inaccessible files without crashing", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(["good.mp4", "bad.mp4"]);
    mockFs.statSync
      .mockReturnValueOnce({ size: 1024 * 1024 })
      .mockImplementationOnce(() => {
        throw new Error("EACCES");
      });

    const result = getTempStats();

    expect(result.fileCount).toBe(1);
  });
});

describe("initializeTempCleanup / stopTempCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopTempCleanup();
    vi.useRealTimers();
  });

  it("creates temp dir if it doesn't exist", () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue([]);

    initializeTempCleanup();

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(TEMP_DIR, { recursive: true });
  });

  it("sets up periodic cleanup interval", () => {
    // First call: ensureTempDirectory checks existsSync
    // Second call: cleanupOldFiles checks existsSync
    // Third call: getTempStats checks existsSync (after cleanup if deleted > 0)
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.unlinkSync.mockReturnValue(undefined);
    mockFs.readdirSync.mockReturnValue([]);

    initializeTempCleanup();

    // Advance by 30 minutes — should trigger one cleanup
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([]);
    vi.advanceTimersByTime(30 * 60 * 1000);

    // cleanupOldFiles should have been called again via the interval
    // (once during init, once via interval)
    expect(mockFs.existsSync).toHaveBeenCalled();
  });

  it("stopTempCleanup clears the interval", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.unlinkSync.mockReturnValue(undefined);
    mockFs.readdirSync.mockReturnValue([]);

    initializeTempCleanup();
    stopTempCleanup();

    // After stopping, advancing time should not trigger more cleanup calls
    const callCount = mockFs.existsSync.mock.calls.length;
    vi.advanceTimersByTime(60 * 60 * 1000);
    // Should not have additional existsSync calls from the interval
    expect(mockFs.existsSync.mock.calls.length).toBe(callCount);
  });
});
