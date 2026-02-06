import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { sanitizeFileName, ensureOutputDir, cleanupDir, safeUnlink } from "../fileUtils";

// Use a temp directory scoped to these tests
const TEST_DIR = path.join(process.cwd(), "output", "__test_fileutils__");

afterEach(() => {
  // Clean up any test artifacts
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("sanitizeFileName", () => {
  it("keeps alphanumeric, dots, hyphens, underscores", () => {
    expect(sanitizeFileName("my-file_v2.mp4")).toBe("my-file_v2.mp4");
  });

  it("replaces spaces with underscores", () => {
    expect(sanitizeFileName("my file name.txt")).toBe("my_file_name.txt");
  });

  it("replaces special characters", () => {
    expect(sanitizeFileName("file@#$%!.mp4")).toBe("file_____.mp4");
  });

  it("handles unicode characters", () => {
    expect(sanitizeFileName("café-résumé.pdf")).toBe("caf_-r_sum_.pdf");
  });

  it("returns unchanged safe filename", () => {
    expect(sanitizeFileName("safe-name.txt")).toBe("safe-name.txt");
  });
});

describe("ensureOutputDir", () => {
  it("creates the base output directory", () => {
    const dir = ensureOutputDir("__test_fileutils__");
    expect(fs.existsSync(dir)).toBe(true);
    expect(dir).toBe(TEST_DIR);
  });

  it("returns existing directory without error", () => {
    ensureOutputDir("__test_fileutils__");
    const dir = ensureOutputDir("__test_fileutils__");
    expect(fs.existsSync(dir)).toBe(true);
  });
});

describe("cleanupDir", () => {
  it("removes an existing directory", () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, "temp.txt"), "data");
    cleanupDir(TEST_DIR);
    expect(fs.existsSync(TEST_DIR)).toBe(false);
  });

  it("does nothing when directory does not exist", () => {
    // Should not throw
    cleanupDir("/nonexistent/path/__test__");
  });
});

describe("safeUnlink", () => {
  it("deletes an existing file", () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    const filePath = path.join(TEST_DIR, "to-delete.txt");
    fs.writeFileSync(filePath, "data");
    safeUnlink(filePath);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("does nothing when file does not exist", () => {
    // Should not throw
    safeUnlink("/nonexistent/file.txt");
  });
});
