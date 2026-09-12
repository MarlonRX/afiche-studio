'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const registry = require('../src/projects/registry');

/* ---------------------------------------------------------------- helpers */

function tmpProjects(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afiche-reg-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function makeProject(dir, name, config = {}) {
  const p = path.join(dir, name);
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, 'index.html'), '<div id="canvas"></div>');
  fs.writeFileSync(path.join(p, 'config.json'), JSON.stringify(config));
}

/* ---------------------------------------------------------------- names */

test('outputName: master variant keeps the bare name', () => {
  assert.strictEqual(registry.outputName('demo', 'post', { masterPreset: 'post' }), 'demo.png');
});

test('outputName: other variants get a preset suffix', () => {
  assert.strictEqual(registry.outputName('demo', 'story', { masterPreset: 'post' }), 'demo-story.png');
  assert.strictEqual(registry.outputName('demo', 'wide', { masterPreset: 'post' }), 'demo-wide.png');
});

test('outputName: respects the format', () => {
  assert.strictEqual(registry.outputName('demo', 'post', { format: 'webp', masterPreset: 'post' }), 'demo.webp');
});

test('outputName: defaults to the global default preset', () => {
  assert.strictEqual(registry.outputName('demo', 'wide'), 'demo.png');
});

/* ---------------------------------------------------------------- listing */

test('list(): detects valid projects (index.html + config.json)', t => {
  const dir = tmpProjects(t);
  makeProject(dir, 'poster-a');
  makeProject(dir, 'poster-b');

  // Without config.json or without index.html it is not a project
  fs.mkdirSync(path.join(dir, 'half-config'));
  fs.writeFileSync(path.join(dir, 'half-config', 'config.json'), '{}');
  fs.mkdirSync(path.join(dir, 'half-html'));
  fs.writeFileSync(path.join(dir, 'half-html', 'index.html'), '<html></html>');
  fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');   // a plain file

  assert.deepStrictEqual(registry.list(dir), ['poster-a', 'poster-b']);
});

test('list(): empty folder returns []', t => {
  const dir = tmpProjects(t);
  assert.deepStrictEqual(registry.list(dir), []);
});

test('read(): null for a missing project, object for a valid one', t => {
  const dir = tmpProjects(t);
  makeProject(dir, 'poster-a', { preset: 'story' });
  assert.strictEqual(registry.read('nope', dir), null);

  const found = registry.read('poster-a', dir);
  assert.strictEqual(found.name, 'poster-a');
  assert.strictEqual(found.config.preset, 'story');
  assert.ok(fs.existsSync(found.html));
});

/* ---------------------------------------------------------------- config */

test('validateConfig fills defaults', () => {
  const cfg = registry.validateConfig({});
  assert.strictEqual(cfg.preset, 'wide');
  assert.strictEqual(cfg.scale, 2);
  assert.strictEqual(cfg.outputFormat, 'png');
});

test('validateConfig keeps valid values, clamps scale', () => {
  const cfg = registry.validateConfig({
    preset: 'story',
    scale: 99,
    outputFormat: 'webp',
  });
  assert.strictEqual(cfg.preset, 'story');
  assert.strictEqual(cfg.scale, 4);
  assert.strictEqual(cfg.outputFormat, 'webp');
});

test('validateConfig falls back to default preset for unknown keys', () => {
  assert.strictEqual(registry.validateConfig({ preset: 'bogus' }).preset, 'wide');
});