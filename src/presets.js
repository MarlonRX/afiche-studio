'use strict';

/**
 * Format presets (logical canvas dimensions in px) and defaults.
 * Single source of truth: CLI, server and editor all read from here.
 */

const PRESETS = {
  wide:   { width: 1920, height: 1080, label: 'Landscape 16:9 (1920x1080) — master' },
  post:   { width: 1080, height: 1080, label: 'Square post (IG/FB)' },
  story:  { width: 1080, height: 1920, label: 'Story / Reel vertical' },
  thumb:  { width: 1280, height: 720,  label: 'YouTube thumbnail' },
  banner: { width: 1500, height: 500,  label: 'X / LinkedIn banner' },
  og:     { width: 1200, height: 630,  label: 'Open Graph' },
};

const FORMATS = ['png', 'webp', 'jpg'];

const DEFAULTS = {
  preset: 'wide',
  scale: 2,
  format: 'png',
  quality: 92,
};

function resolvePreset(key) {
  return PRESETS[key] || null;
}

function presetList() {
  return Object.keys(PRESETS);
}

module.exports = { PRESETS, FORMATS, DEFAULTS, resolvePreset, presetList };
