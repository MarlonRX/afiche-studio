'use strict';

/**
 * Project registry: list / get / paths + config validation.
 * A project is a folder inside projects/ with index.html + config.json.
 * Read-only: creation lives in ./creator.js, rendering in ../render/.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { PRESETS, FORMATS, DEFAULTS } = require('../presets');

/* ---------------------------------------------------------------- listing */

/** Sorted names of every valid project. `projectsDir` is injectable for tests. */
function list(projectsDir = config.PROJECTS_DIR) {
  if (!fs.existsSync(projectsDir)) return [];
  return fs.readdirSync(projectsDir)
    .filter(name => isProject(path.join(projectsDir, name)))
    .sort();
}

function isProject(dir) {
  return fs.existsSync(path.join(dir, 'index.html')) &&
         fs.existsSync(path.join(dir, 'config.json'));
}

function paths(name, projectsDir = config.PROJECTS_DIR) {
  const dir = path.join(projectsDir, String(name));
  return {
    dir,
    html: path.join(dir, 'index.html'),
    config: path.join(dir, 'config.json'),
  };
}

/* ---------------------------------------------------------------- reading */

/**
 * Read one project with its validated config.
 * @returns {{ name, dir, html, config } | null} null when it does not exist.
 */
function read(name, projectsDir = config.PROJECTS_DIR) {
  const p = paths(name, projectsDir);
  if (!isProject(p.dir)) return null;
  return {
    name: String(name),
    ...p,
    config: validateConfig(readJson(p.config)),
  };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Fill defaults and drop impossible values, so callers never
 * need to defend against a broken config.json.
 */
function validateConfig(cfg = {}) {
  const out = { ...cfg };

  const hasCustomDims = Number(cfg.width) > 0 && Number(cfg.height) > 0;
  if (!out.preset || (!PRESETS[out.preset] && !hasCustomDims)) {
    out.preset = DEFAULTS.preset;
  }

  const scale = Number(out.scale);
  out.scale = scale > 0 ? Math.min(Math.max(scale, 1), 4) : DEFAULTS.scale;

  if (!FORMATS.includes(out.outputFormat)) out.outputFormat = DEFAULTS.format;

  return out;
}

/* ---------------------------------------------------------------- naming */

/**
 * Output file name for a render: the master variant keeps the bare name,
 * every other variant is suffixed (`demo-story.png`).
 */
function outputName(name, presetKey, { format = DEFAULTS.format, masterPreset = DEFAULTS.preset } = {}) {
  const suffix = presetKey && presetKey !== masterPreset ? `-${presetKey}` : '';
  return `${name}${suffix}.${format}`;
}

module.exports = { list, isProject, paths, read, validateConfig, outputName };
