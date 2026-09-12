'use strict';

/**
 * Small HTTP helpers shared by the route modules
 * (responses, request body, safe path joining, MIME types).
 */

const path = require('path');
const fs = require('fs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(res, code, body, headers = {}) {
  // dev server: always serve fresh bytes (index.html, styles.css, previews)
  res.writeHead(code, { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': MIME['.json'] });
}

/** Read the whole request body as text (default cap 5 MB). */
function readBody(req, maxBytes = 5e6) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => {
      buf += c;
      if (buf.length > maxBytes) { reject(new Error('payload too large')); req.destroy(); }
    });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

/** join() that refuses to escape `base` (anti path-traversal). */
function safeJoin(base, target) {
  const p = path.normalize(path.join(base, target));
  if (!p.startsWith(path.normalize(base))) return null;
  return p;
}

/** Serve an existing file with its MIME type, or 404. Returns true if handled. */
function serveFile(res, file) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  send(res, 200, fs.readFileSync(file), { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  return true;
}

module.exports = { MIME, send, sendJson, readBody, safeJoin, serveFile };
