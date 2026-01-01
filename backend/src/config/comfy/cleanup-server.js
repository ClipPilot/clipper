/**
 * Cleanup Server - Run this on your GPU pod alongside ComfyUI
 *
 * Usage: node cleanup-server.js
 *
 * This exposes a simple API to delete input/output files from ComfyUI
 * to prevent SSD from filling up.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const COMFY_DIR = process.env.COMFY_DIR || '/workspace/ComfyUI';
const INPUT_DIR = path.join(COMFY_DIR, 'input');
const OUTPUT_DIR = path.join(COMFY_DIR, 'output');
const API_KEY = process.env.CLEANUP_API_KEY || '';

function deleteFile(dir, filename) {
  // Sanitize filename to prevent directory traversal
  const sanitized = path.basename(filename);
  const filePath = path.join(dir, sanitized);

  if (!filePath.startsWith(dir)) {
    return { success: false, error: 'Invalid path' };
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[cleanup] Deleted: ${filePath}`);
      return { success: true };
    } else {
      return { success: false, error: 'File not found' };
    }
  } catch (err) {
    console.error(`[cleanup] Error deleting ${filePath}:`, err.message);
    return { success: false, error: err.message };
  }
}

function deleteDirectory(dir, subfolder) {
  // For cleaning up output subfolders
  const sanitized = path.basename(subfolder);
  const dirPath = path.join(dir, sanitized);

  if (!dirPath.startsWith(dir)) {
    return { success: false, error: 'Invalid path' };
  }

  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`[cleanup] Deleted directory: ${dirPath}`);
      return { success: true };
    } else {
      return { success: false, error: 'Directory not found' };
    }
  } catch (err) {
    console.error(`[cleanup] Error deleting ${dirPath}:`, err.message);
    return { success: false, error: err.message };
  }
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Check API key if configured
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Delete input file: DELETE /input/:filename
  if (req.method === 'DELETE' && url.pathname.startsWith('/input/')) {
    const filename = decodeURIComponent(url.pathname.replace('/input/', ''));
    const result = deleteFile(INPUT_DIR, filename);
    res.writeHead(result.success ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // Delete output file: DELETE /output/:filename
  if (req.method === 'DELETE' && url.pathname.startsWith('/output/')) {
    const filename = decodeURIComponent(url.pathname.replace('/output/', ''));

    // Check if it's a file in a subfolder (e.g., "AnimateDiff/video.mp4")
    if (filename.includes('/')) {
      const [subfolder, file] = filename.split('/');
      const result = deleteFile(path.join(OUTPUT_DIR, subfolder), file);
      res.writeHead(result.success ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } else {
      const result = deleteFile(OUTPUT_DIR, filename);
      res.writeHead(result.success ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    }
    return;
  }

  // Bulk cleanup: POST /cleanup
  if (req.method === 'POST' && url.pathname === '/cleanup') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { inputs = [], outputs = [] } = JSON.parse(body);
        const results = {
          inputs: inputs.map(f => ({ file: f, ...deleteFile(INPUT_DIR, f) })),
          outputs: outputs.map(f => ({ file: f, ...deleteFile(OUTPUT_DIR, f) })),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[cleanup] Cleanup server running on port ${PORT}`);
  console.log(`[cleanup] Input dir: ${INPUT_DIR}`);
  console.log(`[cleanup] Output dir: ${OUTPUT_DIR}`);
});
