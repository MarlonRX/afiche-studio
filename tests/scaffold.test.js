'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { scan, mix, normalizeHex } = require('../src/scaffold/scan');
const { scaffold } = require('../src/scaffold');

/* ---------------------------------------------------------------- fixtures */

function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afiche-scan-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A little web app with global styles to scan. */
function fixtureApp(t) {
  const app = path.join(tmpDir(t), 'app');
  fs.mkdirSync(path.join(app, 'css'), { recursive: true });

  fs.writeFileSync(path.join(app, 'index.html'), `
<!DOCTYPE html>
<html><head>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root { --accent: #ff5500; --bg: #101014; --text: #f2f2f2; --line: #2a2a33; --error: #ff3333; }
</style>
</head><body><h1>My App</h1></body></html>`);

  fs.writeFileSync(path.join(app, 'css', 'base.css'), `
body { background: #101014; color: #f2f2f2; font-family: "Space Grotesk", sans-serif; }
.btn { background: #ff5500; border-radius: 8px; padding: 10px 16px; }
.card { background: #1a1a22; border: 1px solid #2a2a33; border-radius: 8px; }`);

  fs.writeFileSync(path.join(app, 'css', 'theme.css'), `
a { color: #ff5500; }
.surface { background: #1a1a22; }`);

  // noise that must be ignored
  fs.mkdirSync(path.join(app, 'node_modules/pkg/styles'), { recursive: true });
  fs.writeFileSync(path.join(app, 'node_modules/pkg/styles/x.css'), '.x{color:red}');

  return app;
}

/* ---------------------------------------------------------------- scan */

test('scan() extracts accent/background/text and fonts', t => {
  const app = fixtureApp(t);
  const tokens = scan(app);

  assert.strictEqual(tokens.colors.accent, '#ff5500');
  assert.strictEqual(tokens.colors.background, '#101014');
  assert.strictEqual(tokens.colors.text, '#f2f2f2');
  assert.strictEqual(tokens.colors.error, '#ff3333');

  assert.strictEqual(tokens.radius, '8px');

  // the google-linked family is preferred
  assert.strictEqual(tokens.fonts.display, 'Space Grotesk');

  // node_modules noise and root vars counted
  assert.ok(tokens.meta.cssFiles >= 2);
  assert.ok(tokens.meta.styleBlocks >= 1);
  assert.strictEqual(tokens.meta.rootVars, 5);
});

test('scan() returns derived tones (muted, accent2) as valid hex', t => {
  const app = fixtureApp(t);
  const tokens = scan(app);
  assert.match(tokens.colors.muted, /^#[0-9a-f]{6}$/);
  assert.match(tokens.colors.accent2, /^#[0-9a-f]{6}$/);
  assert.match(tokens.colors.border, /^#[0-9a-f]{6}$/);
});

test('scan() handles a folder with no css -> empty meta, no crash', t => {
  const dir = tmpDir(t);
  fs.writeFileSync(path.join(dir, 'readme.txt'), 'no styles here');
  const tokens = scan(dir);
  assert.strictEqual(tokens.meta.cssFiles + tokens.meta.styleBlocks, 0);
  // falls back to a usable palette
  assert.match(tokens.colors.accent, /^#[0-9a-f]{6}$/);
});

/* ---------------------------------------------------------------- helpers */

test('normalizeHex expands short, drops alpha and prefixes #', () => {
  assert.strictEqual(normalizeHex('#abc'), '#aabbcc');
  assert.strictEqual(normalizeHex('#ff5500'), '#ff5500');
  assert.strictEqual(normalizeHex('#ff5500cc'), '#ff5500');
  assert.strictEqual(normalizeHex('#FF5500'), '#ff5500');
  assert.strictEqual(normalizeHex('nope'), null);
});

test('mix() blends two hex colors', () => {
  assert.strictEqual(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.strictEqual(mix('#000000', '#ffffff', 0), '#000000');
  assert.strictEqual(mix('#000000', '#ffffff', 1), '#ffffff');
});

/* ---------------------------------------------------------------- scaffold */

test('scaffold() accepts uploaded files (browser picker flow)', t => {
  const projects = tmpDir(t);
  const res = scaffold({
    name: 'uploaded',
    files: [
      { path: 'styles/tokens.css', content: ':root { --accent: #22cc88; --bg: #0a0a0a; --text: #ffffff; }' },
      { path: 'main.css', content: 'body { background: #0a0a0a; color: #ffffff; } .btn { border-radius: 6px; }' },
    ],
    projectsDir: projects,
  });

  assert.strictEqual(res.tokens.colors.accent, '#22cc88');
  const html = fs.readFileSync(path.join(res.dir, 'index.html'), 'utf8');
  assert.ok(html.includes('#22cc88'));
});

test('scaffold() uploads ignore non-style and path-traversing files', t => {
  const projects = tmpDir(t);
  // "../../etc.secret" would escape the staging dir; must be ignored.
  const res = scaffold({
    name: 'clean',
    files: [
      { path: '../../etc/passwd.css', content: 'body{color:red}' },
      { path: 'notes.txt', content: 'not css' },
      { path: 'real.css', content: 'body { background: #123456; color: #eeeeee; }' },
    ],
    projectsDir: projects,
  });
  // the traversal skip counts as NO_CSS for that file; the valid one wins:
  assert.ok(fs.existsSync(path.join(projects, 'clean', 'index.html')));
  assert.strictEqual(res.tokens.colors.background, '#123456');
});

test('scaffold() uploads with no valid styles -> NO_CSS', t => {
  const projects = tmpDir(t);
  assert.throws(() => scaffold({
    name: 'empty-up',
    files: [{ path: 'notes.txt', content: 'hi' }, { path: '../x.css', content: 'a{}' }],
    projectsDir: projects,
  }), err => err.code === 'NO_CSS');
});

test('scaffold() writes a usable project from the scanned tokens', t => {
  const app = fixtureApp(t);
  const projects = tmpDir(t);

  const { name, dir, title, tokens } = scaffold({ name: 'my-scaffold', appPath: app, projectsDir: projects });
  assert.strictEqual(name, 'my-scaffold');
  assert.match(title, /My-scaffold/);

  const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  assert.strictEqual(config.preset, 'wide');
  assert.strictEqual(config.brand.colors.accent, '#ff5500');

  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.ok(html.includes('--accent: #ff5500'));
  assert.ok(html.includes('Space Grotesk'));
  assert.ok(html.includes('#canvas'));
  assert.ok(html.includes('../../shared/scripts/adaptive.js'));

  assert.strictEqual(tokens.colors.background, '#101014');
});

test('scaffold() validates inputs', t => {
  const projects = tmpDir(t);
  const app = fixtureApp(t);

  assert.throws(() => scaffold({ name: 'x', appPath: '/definitely/not/here', projectsDir: projects }),
    err => err.code === 'PATH_NOT_FOUND');

  assert.throws(() => scaffold({ name: 'x', appPath: '', projectsDir: projects }),
    err => err.code === 'PATH_NOT_FOUND');

  assert.throws(() => scaffold({ name: 'x', appPath: projects, projectsDir: projects }),
    err => err.code === 'NO_CSS' || err.code === 'PATH_NOT_FOUND');
});

test('scaffold() refuses duplicate names', t => {
  const projects = tmpDir(t);
  const app = fixtureApp(t);
  scaffold({ name: 'dup', appPath: app, projectsDir: projects });
  assert.throws(() => scaffold({ name: 'dup', appPath: app, projectsDir: projects }),
    err => err.code === 'EXISTS');
});