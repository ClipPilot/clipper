import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";

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

const OUTPUT_DIR = path.join(process.cwd(), "output");

function mockDirEntries(
  dirMap: Record<string, Array<{ name: string; isDirectory: () => boolean }>>
) {
  mockFs.readdirSync.mockImplementation((dir: string) => {
    return dirMap[dir] || [];
  });
}

function mockExistingDirs(dirs: string[]) {
  mockFs.existsSync.mockImplementation((p: string) => dirs.includes(p));
}

describe("TEMP_DIR", () => {
  it("is based on process.cwd()", () => {
    expect(TEMP_DIR).toBe(path.join(process.cwd(), "temp"));
  });
});

describe("cleanupOldFiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns {deleted: 0, errors: 0} when neither dir exists", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = cleanupOldFiles();

    expect(result).toEqual({ deleted: 0, errors: 0 });
  });

  it("deletes old files from temp dir", () => {
    mockExistingDirs([TEMP_DIR]);
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    mockDirEntries({
      [TEMP_DIR]: [{ name: "old-file.mp4", isDirectory: () => false }],
    });
    mockFs.statSync.mockReturnValue({ mtimeMs: twoHoursAgo });

    const result = cleanupOldFiles();

    expect(mockFs.unlinkSync).toHaveBeenCalledWith(
      path.join(TEMP_DIR, "old-file.mp4")
    );
    expect(result.deleted).toBe(1);
  });

  it("deletes old files from output dir", () => {
    mockExistingDirs([OUTPUT_DIR]);
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    mockDirEntries({
      [OUTPUT_DIR]: [{ name: "stale-video.mp4", isDirectory: () => false }],
    });
    mockFs.statSync.mockReturnValue({ mtimeMs: twoHoursAgo });

    const result = cleanupOldFiles();

    expect(mockFs.unlinkSync).toHaveBeenCalledWith(
      path.join(OUTPUT_DIR, "stale-video.mp4")
    );
    expect(result.deleted).toBe(1);
  });

  it("sums deletions across both dirs", () => {
    mockExistingDirs([TEMP_DIR, OUTPUT_DIR]);
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    mockDirEntries({
      [TEMP_DIR]: [{ name: "old-temp.mp4", isDirectory: () => false }],
      [OUTPUT_DIR]: [{ name: "old-output.mp4", isDirectory: () => false }],
    });
    mockFs.statSync.mockReturnValue({ mtimeMs: twoHoursAgo });

    const result = cleanupOldFiles();

    expect(result.deleted).toBe(2);
    expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);
  });

  it("removes old directories recursively", () => {
    mockExistingDirs([TEMP_DIR]);
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    mockDirEntries({
      [TEMP_DIR]: [{ name: "old-dir", isDirectory: () => true }],
    });
    mockFs.statSync.mockReturnValue({ mtimeMs: twoHoursAgo });

    const result = cleanupOldFiles();

    expect(mockFs.rmSync).toHaveBeenCalledWith(
      path.join(TEMP_DIR, "old-dir"),
      { recursive: true, force: true }
    );
    expect(result.deleted).toBe(1);
  });

  it("skips recent files", () => {
    mockExistingDirs([TEMP_DIR, OUTPUT_DIR]);
    mockDirEntries({
      [TEMP_DIR]: [{ name: "new-file.mp4", isDirectory: () => false }],
      [OUTPUT_DIR]: [{ name: "new-output.mp4", isDirectory: () => false }],
    });
    mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() - 1000 });

    const result = cleanupOldFiles();

    expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
  });

  it("counts errors for inaccessible files", () => {
    mockExistingDirs([TEMP_DIR]);
    mockDirEntries({
      [TEMP_DIR]: [{ name: "locked-file", isDirectory: () => false }],
    });
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

  it("returns zeros when neither dir exists", () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = getTempStats();

    expect(result).toEqual({ fileCount: 0, totalSizeMB: 0 });
  });

  it("counts files and sums sizes across both dirs", () => {
    mockExistingDirs([TEMP_DIR, OUTPUT_DIR]);
    mockFs.readdirSync.mockImplementation((dir: string) => {
      if (dir === TEMP_DIR) return ["file1.mp4"];
      if (dir === OUTPUT_DIR) return ["file2.mp4"];
      return [];
    });
    mockFs.statSync
      .mockReturnValueOnce({ size: 1024 * 1024 })
      .mockReturnValueOnce({ size: 2 * 1024 * 1024 });

    const result = getTempStats();

    expect(result.fileCount).toBe(2);
    expect(result.totalSizeMB).toBe(3);
  });

  it("skips inaccessible files without crashing", () => {
    mockExistingDirs([TEMP_DIR]);
    mockFs.readdirSync.mockImplementation((dir: string) => {
      if (dir === TEMP_DIR) return ["good.mp4", "bad.mp4"];
      return [];
    });
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
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.unlinkSync.mockReturnValue(undefined);
    mockFs.readdirSync.mockReturnValue([]);

    initializeTempCleanup();

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([]);
    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(mockFs.existsSync).toHaveBeenCalled();
  });

  it("stopTempCleanup clears the interval", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.unlinkSync.mockReturnValue(undefined);
    mockFs.readdirSync.mockReturnValue([]);

    initializeTempCleanup();
    stopTempCleanup();

    const callCount = mockFs.existsSync.mock.calls.length;
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(mockFs.existsSync.mock.calls.length).toBe(callCount);
  });
});
