import fs from "fs";
import path from "path";

const TEMP_DIR = path.join(process.cwd(), "temp");
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

function cleanupOldFiles(): { deleted: number; errors: number } {
  const now = Date.now();
  let deleted = 0;
  let errors = 0;

  if (!fs.existsSync(TEMP_DIR)) {
    return { deleted, errors };
  }

  try {
    const entries = fs.readdirSync(TEMP_DIR, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(TEMP_DIR, entry.name);

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
    console.error(`[TEMP] Failed to read temp directory:`, err);
  }

  if (deleted > 0) {
    console.log(`[TEMP] Cleaned up ${deleted} old files/directories`);
  }

  return { deleted, errors };
}

function getTempStats(): { fileCount: number; totalSizeMB: number } {
  let fileCount = 0;
  let totalSize = 0;

  if (!fs.existsSync(TEMP_DIR)) {
    return { fileCount, totalSizeMB: 0 };
  }

  try {
    const entries = fs.readdirSync(TEMP_DIR);
    for (const entry of entries) {
      try {
        const stats = fs.statSync(path.join(TEMP_DIR, entry));
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
