'use strict';

/**
 * Renderer: render({ project, preset, ... }) -> file on disk.
 * Forces the logical size of #canvas to the requested variant, so the
 * same design can be exported to every format without touching the HTML.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { PRESETS, FORMATS, DEFAULTS, presetList } = require('../presets');
const registry = require('../projects/registry');
const { getBrowser } = require('./browser');

/**
 * Resolve the final canvas size.
 * Priority: explicit width+height > preset param > config preset > config dims.
 */
function resolveSize(cfg, { preset = null, width = null, height = null } = {}) {
  if (width && height) {
    const key = preset && PRESETS[preset] ? preset : null;
    return { width: Number(width), height: Number(height), presetKey: key };
  }

  const key = preset || cfg.preset || DEFAULTS.preset;
  if (PRESETS[key]) return { width: PRESETS[key].width, height: PRESETS[key].height, presetKey: key };

  if (cfg.width && cfg.height) return { width: Number(cfg.width), height: Number(cfg.height), presetKey: null };

  throw new Error(`unknown preset "${key}". Valid: ${presetList().join(', ')}`);
}

/**
 * @param {object}   opts
 * @param {string}   opts.project  project name (required)
 * @param {string}   [opts.preset] variant key; defaults to the project's master preset
 * @param {number}   [opts.width]  custom canvas width (with height, overrides preset)
 * @param {number}   [opts.height] custom canvas height
 * @param {number}   [opts.scale]  deviceScaleFactor (1-4), default from config
 * @param {string}   [opts.format] png | webp | jpg
 * @param {number}   [opts.quality] for lossy formats
 * @param {string}   [opts.output] exact output file name (skips the naming rule)
 * @param {string}   [opts.outputsDir] where to write (injectable for tests)
 * @returns {Promise<{ file, name, bytes, width, height, presetKey, scale }>}
 */
async function render({
  project,
  preset = null,
  width = null,
  height = null,
  scale = null,
  format = null,
  quality = null,
  output = null,
  outputsDir = config.OUTPUTS_DIR,
} = {}) {
  const found = registry.read(project);
  if (!found) throw new Error(`project "${project}" does not exist`);
  const cfg = found.config;

  const size = resolveSize(cfg, { preset, width, height });
  const factor = scale || cfg.scale || DEFAULTS.scale;
  const fmt = format || cfg.outputFormat || DEFAULTS.format;
  if (!FORMATS.includes(fmt)) {
    throw new Error(`invalid format "${fmt}". Valid: ${FORMATS.join(', ')}`);
  }

  const fileName = output || registry.outputName(project, size.presetKey, {
    format: fmt,
    masterPreset: PRESETS[cfg.preset] ? cfg.preset : DEFAULTS.preset,
  });
  const file = path.isAbsolute(fileName) ? fileName : path.join(outputsDir, fileName);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: factor });
    await page.goto('file:///' + found.html.replace(/\\/g, '/'), {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    // Force the logical canvas size for this variant
    await page.evaluate((w, h) => {
      const c = document.getElementById('canvas') || document.body.firstElementChild;
      if (!c) return;
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      c.dataset.width = w;
      c.dataset.height = h;
    }, size.width, size.height);

    // Wait for web fonts before taking the shot
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 400));

    const target = (await page.$('#canvas')) || (await page.$('body'));
    const type = fmt === 'jpg' ? 'jpeg' : fmt;
    const opts = { path: file, type };
    if (type !== 'png') opts.quality = quality || DEFAULTS.quality;
    await target.screenshot(opts);
  } finally {
    await page.close().catch(() => {});
  }

  return { file, name: path.basename(file), bytes: fs.statSync(file).size, scale: factor, ...size };
}

module.exports = { render, resolveSize };
