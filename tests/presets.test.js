'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { PRESETS, DEFAULTS, FORMATS, resolvePreset } = require('../src/presets');

test('every preset has positive integer dimensions and a label', () => {
  for (const [key, p] of Object.entries(PRESETS)) {
    assert.ok(Number.isInteger(p.width) && p.width > 0, `preset "${key}" width`);
    assert.ok(Number.isInteger(p.height) && p.height > 0, `preset "${key}" height`);
    assert.ok(p.label.length > 0, `preset "${key}" label`);
  }
});

test('covers every social format', () => {
  for (const key of ['wide', 'post', 'story', 'thumb', 'banner', 'og']) {
    assert.ok(PRESETS[key], `missing preset "${key}"`);
  }
});

test('default preset exists and is well formed', () => {
  assert.ok(PRESETS[DEFAULTS.preset]);
  assert.ok(PRESETS[DEFAULTS.preset].width > 0);
});

test('default scale is within render bounds', () => {
  assert.ok(DEFAULTS.scale >= 1 && DEFAULTS.scale <= 4);
});

test('default format is supported', () => {
  assert.ok(FORMATS.includes(DEFAULTS.format));
  assert.strictEqual(DEFAULTS.format, 'png');
});

test('resolvePreset returns the preset or null', () => {
  assert.ok(resolvePreset('post'));
  assert.ok(resolvePreset('bogus') === null);
  assert.ok(resolvePreset('') === null);
});