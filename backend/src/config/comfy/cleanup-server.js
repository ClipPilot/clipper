/**
 * Cleanup Server - Run this on your GPU pod alongside ComfyUI
 *
 * Usage: node cleanup-server.js
 *
 * This exposes a simple API to delete input/output files from ComfyUI
 * to prevent SSD from filling up.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3001;
const COMFY_DIR = process.env.COMFY_DIR || "/workspace/ComfyUI";
const INPUT_DIR = path.join(COMFY_DIR, "input");
const OUTPUT_DIR = path.join(COMFY_DIR, "output");
const API_KEY = process.env.CLEANUP_API_KEY || "";

function deleteFile(dir, filename) {
  // Sanitize filename to prevent directory traversal
  const sanitized = path.basename(filename);
  const filePath = path.join(dir, sanitized);

  if (!filePath.startsWith(dir)) {
    return { success: false, error: "Invalid path" };
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[cleanup] Deleted: ${filePath}`);
      return { success: true };
    } else {
      return { success: false, error: "File not found" };
    }
  } catch (err) {
    console.error(`[cleanup] Error deleting ${filePath}:`, err.message);
    return { success: false, error: err.message };
  }
}

function deleteOldFiles(dir, maxAgeDays = 4) {
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const deleted = [];
  const errors = [];

  try {
    if (!fs.existsSync(dir)) {
      return { deleted, errors, message: "Directory not found" };
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      try {
        const stats = fs.statSync(entryPath);
        const age = now - stats.mtimeMs;

        if (age > maxAgeMs) {
          if (entry.isDirectory()) {
            fs.rmSync(entryPath, { recursive: true, force: true });
            console.log(`[cleanup] Deleted old directory: ${entryPath}`);
          } else {
            fs.unlinkSync(entryPath);
            console.log(`[cleanup] Deleted old file: ${entryPath}`);
          }
          deleted.push(entry.name);
        }
      } catch (err) {
        console.error(`[cleanup] Error processing ${entryPath}:`, err.message);
        errors.push({ file: entry.name, error: err.message });
      }
    }
  } catch (err) {
    console.error(`[cleanup] Error reading directory ${dir}:`, err.message);
    return { deleted, errors, message: err.message };
  }

  return { deleted, errors };
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Check API key if configured
  if (API_KEY && req.headers["x-api-key"] !== API_KEY) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Delete input file: DELETE /input/:filename
  if (req.method === "DELETE" && url.pathname.startsWith("/input/")) {
    const filename = decodeURIComponent(url.pathname.replace("/input/", ""));
    const result = deleteFile(INPUT_DIR, filename);
    res.writeHead(result.success ? 200 : 404, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(result));
    return;
  }

  // Delete output file: DELETE /output/:filename
  if (req.method === "DELETE" && url.pathname.startsWith("/output/")) {
    const filename = decodeURIComponent(url.pathname.replace("/output/", ""));

    // Check if it's a file in a subfolder (e.g., "AnimateDiff/video.mp4")
    if (filename.includes("/")) {
      const [subfolder, file] = filename.split("/");
      const result = deleteFile(path.join(OUTPUT_DIR, subfolder), file);
      res.writeHead(result.success ? 200 : 404, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(result));
    } else {
      const result = deleteFile(OUTPUT_DIR, filename);
      res.writeHead(result.success ? 200 : 404, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(result));
    }
    return;
  }

  // Cleanup old files (>2 days): POST /cleanup-old or DELETE /cleanup-old
  if (
    (req.method === "POST" || req.method === "DELETE") &&
    url.pathname === "/cleanup-old"
  ) {
    const inputResults = deleteOldFiles(INPUT_DIR, 4);
    const outputResults = deleteOldFiles(OUTPUT_DIR, 4);

    const totalDeleted =
      inputResults.deleted.length + outputResults.deleted.length;
    console.log(
      `[cleanup] Old file cleanup complete: ${totalDeleted} items deleted`
    );

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        inputs: inputResults,
        outputs: outputResults,
        totalDeleted,
      })
    );
    return;
  }

  // Bulk cleanup: POST /cleanup
  if (req.method === "POST" && url.pathname === "/cleanup") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { inputs = [], outputs = [] } = JSON.parse(body);
        const results = {
          inputs: inputs.map((f) => ({ file: f, ...deleteFile(INPUT_DIR, f) })),
          outputs: outputs.map((f) => ({
            file: f,
            ...deleteFile(OUTPUT_DIR, f),
          })),
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(results));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[cleanup] Cleanup server running on port ${PORT}`);
  console.log(`[cleanup] Input dir: ${INPUT_DIR}`);
  console.log(`[cleanup] Output dir: ${OUTPUT_DIR}`);
});
