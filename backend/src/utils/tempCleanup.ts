import fs from "fs";
import path from "path";

const TEMP_DIR = path.join(process.cwd(), "temp");
const OUTPUT_DIR = path.join(process.cwd(), "output");
const MAX_AGE_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

function ensureTempDirectory(): void {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`[TEMP] Created temp directory: ${TEMP_DIR}`);
    return;
  }

  try {
    const testFile = path.join(TEMP_DIR, `.write-test-${Date.now()}`);
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
  } catch (err) {
    console.error(`[TEMP] Directory not writable: ${TEMP_DIR}`, err);
    throw new Error(`Temp directory not writable: ${TEMP_DIR}`);
  }
}

function cleanupDir(dir: string, label: string): { deleted: number; errors: number } {
  const now = Date.now();
  let deleted = 0;
  let errors = 0;

  if (!fs.existsSync(dir)) {
    return { deleted, errors };
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      try {
        const stats = fs.statSync(entryPath);
        const age = now - stats.mtimeMs;

        if (age > MAX_AGE_MS) {
          if (entry.isDirectory()) {
            fs.rmSync(entryPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(entryPath);
          }
          deleted++;
        }
      } catch {
        errors++;
      }
    }
  } catch (err) {
    console.error(`[${label}] Failed to read directory:`, err);
  }

  if (deleted > 0) {
    console.log(`[${label}] Cleaned up ${deleted} old files/directories`);
  }

  return { deleted, errors };
}

function cleanupOldFiles(): { deleted: number; errors: number } {
  const temp = cleanupDir(TEMP_DIR, "TEMP");
  const output = cleanupDir(OUTPUT_DIR, "OUTPUT");
  return { deleted: temp.deleted + output.deleted, errors: temp.errors + output.errors };
}

function getDirStats(dir: string): { fileCount: number; totalSizeMB: number } {
  let fileCount = 0;
  let totalSize = 0;

  if (!fs.existsSync(dir)) {
    return { fileCount, totalSizeMB: 0 };
  }

  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      try {
        const stats = fs.statSync(path.join(dir, entry));
        fileCount++;
        totalSize += stats.size;
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Directory read failed
  }

  return { fileCount, totalSizeMB: Math.round(totalSize / 1024 / 1024) };
}

function getTempStats(): { fileCount: number; totalSizeMB: number } {
  const temp = getDirStats(TEMP_DIR);
  const output = getDirStats(OUTPUT_DIR);
  return {
    fileCount: temp.fileCount + output.fileCount,
    totalSizeMB: temp.totalSizeMB + output.totalSizeMB,
  };
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function initializeTempCleanup(): void {
  ensureTempDirectory();

  const initialStats = getTempStats();
  console.log(`[TEMP] Directory: ${TEMP_DIR} (${initialStats.fileCount} files, ${initialStats.totalSizeMB}MB)`);

  const { deleted } = cleanupOldFiles();
  if (deleted > 0) {
    const afterStats = getTempStats();
    console.log(`[TEMP] After cleanup: ${afterStats.fileCount} files, ${afterStats.totalSizeMB}MB`);
  }

  cleanupInterval = setInterval(() => {
    cleanupOldFiles();
  }, CLEANUP_INTERVAL_MS);

  console.log(`[TEMP] Periodic cleanup scheduled every ${CLEANUP_INTERVAL_MS / 60000} minutes`);
}

export function stopTempCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export { TEMP_DIR, cleanupOldFiles, getTempStats };
