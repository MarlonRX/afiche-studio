'use strict';

/**
 * Project creator: copies templates/ into projects/<name> and
 * personalizes config.json. Throws Errors with a `code` so both the
 * CLI (friendly message) and the server (HTTP status) can map failures.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

/** `My New Post` -> `my-new-post` */
function sanitize(name) {
  return String(name || '').trim().replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
}

/**
 * @param {string} name           desired project name
 * @param {object} [options]      dirs (injectable for tests)
 * @returns {{ name: string, dir: string }}
 * @throws Error with code INVALID_NAME | EXISTS | NO_TEMPLATE
 */
function create(name, { projectsDir = config.PROJECTS_DIR, templatesDir = config.TEMPLATES_DIR } = {}) {
  const clean = sanitize(name);
  if (!clean) throw fail('invalid project name', 'INVALID_NAME');

  const dir = path.join(projectsDir, clean);
  if (fs.existsSync(dir)) throw fail(`project "${clean}" already exists`, 'EXISTS');
  if (!fs.existsSync(templatesDir)) throw fail('templates/ folder not found', 'NO_TEMPLATE');

  fs.mkdirSync(projectsDir, { recursive: true });
  fs.cpSync(templatesDir, dir, { recursive: true });

  const cfgPath = path.join(dir, 'config.json');
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { /* fresh config */ }
  cfg.name = clean;
  cfg.title = `${clean.charAt(0).toUpperCase() + clean.slice(1)} — promotional image`;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

  return { name: clean, dir };
}

function fail(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

module.exports = { create, sanitize };
