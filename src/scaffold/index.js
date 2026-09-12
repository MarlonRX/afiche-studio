'use strict';

/**
 * Scaffold orchestrator: create a generic afiche project from global CSS.
 *
 * Two sources are supported:
 *   - appPath: a folder on disk to scan (CLI / scripts)
 *   - files:   uploaded styles from the browser picker
 *              ([{ path: 'styles/main.css', content: '...' }])
 *
 *   scaffold({ name, appPath }) -> { name, dir, title, tokens }
 *   scaffold({ name, files })   -> { name, dir, title, tokens }
 *
 * Reuses creator.create() for the folder/name rules (INVALID_NAME, EXISTS),
 * then overwrites config.json + index.html with the token-driven ones.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../config');
const creator = require('../projects/creator');
const scanner = require('./scan');
const { generate } = require('./generate');

const EXT_STYLES = /\.(css|html?)$/i;

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * @param {object} opts
 * @param {string} opts.name      project folder name
 * @param {string} [opts.appPath] folder of the web app to scan from disk
 * @param {Array}  [opts.files]   uploaded styles files [{ path, content }]
 * @param {string} [opts.title]   poster title (default: capitalized name)
 * @param {string} [opts.projectsDir] injectable for tests
 * @returns {{ name, dir, title, tokens }}
 * @throws Error with code INVALID_NAME | EXISTS | PATH_NOT_FOUND | PATH_NOT_DIR | NO_CSS
 */
function scaffold({ name, appPath, files, title = null, projectsDir = config.PROJECTS_DIR } = {}) {
  const clean = creator.sanitize(name);
  if (!clean) throw fail('invalid project name', 'INVALID_NAME');

  // Uploaded files: stage them in a temp folder, scan that, then drop it.
  let staging = null;
  let tokens;
  if (Array.isArray(files) && files.length) {
    staging = writeStaging(files);
    try {
      tokens = scanner.scan(staging);
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
    }
  } else {
    if (!appPath || !fs.existsSync(appPath)) {
      throw fail(`folder not found: ${appPath || '(empty)'}`, 'PATH_NOT_FOUND');
    }
    if (!fs.statSync(appPath).isDirectory()) {
      throw fail(`not a directory: ${appPath}`, 'PATH_NOT_DIR');
    }
    tokens = scanner.scan(appPath);
  }

  if (!tokens.meta.cssFiles && !tokens.meta.styleBlocks) {
    throw fail(staging ? 'no css/html files selected' : 'no CSS found in the folder (skipped node_modules/dist/build)', 'NO_CSS');
  }

  const finalTitle = title || `${cap(clean)} — promotional poster`;
  const { dir } = creator.create(clean, { projectsDir, templatesDir: config.TEMPLATES_DIR });
  generate({ name: clean, title: finalTitle, tokens, dir });

  return { name: clean, dir, title: finalTitle, tokens };
}

/* ------------------------------------------------------------ uploads */

/**
 * Write uploaded styles into a temp folder with their relative paths.
 * Skips files that are not css/html, too large, or path-traversing.
 * @returns {string} the temp folder (caller cleans it up)
 */
function writeStaging(files) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'afiche-up-'));
  let written = 0;
  for (const f of files) {
    const rel = safeRelPath(f.path);
    if (!rel || !EXT_STYLES.test(rel)) continue;
    if (String(f.content || '').length > scanner.MAX_FILE_SIZE) continue;

    const full = path.join(staging, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, String(f.content ?? ''));
    written++;
  }
  if (!written) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw fail('no valid styles uploaded', 'NO_CSS');
  }
  return staging;
}

/** No absolute paths, no parent-.. escapes. */
function safeRelPath(p) {
  const norm = String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm || norm.split('/').includes('..')) return null;
  return norm;
}

function fail(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

module.exports = { scaffold, safeRelPath };