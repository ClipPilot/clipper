import fs from "fs";
import path from "path";

/**
 * Ensures the output directory exists, creating it if necessary.
 * @param subDir Optional subdirectory within output folder
 * @returns The full path to the output directory
 */
export function ensureOutputDir(subDir?: string): string {
  const baseDir = path.join(process.cwd(), "output");
  const outDir = subDir ? path.join(baseDir, subDir) : baseDir;

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  return outDir;
}

/**
 * Sanitizes a filename by replacing invalid characters with underscores.
 * Safe for S3 keys and filesystem paths.
 */
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Cleans up a directory and all its contents.
 * Silently ignores errors if directory doesn't exist.
 */
export function cleanupDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Safely deletes a file, ignoring errors if it doesn't exist.
 */
export function safeUnlink(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}
