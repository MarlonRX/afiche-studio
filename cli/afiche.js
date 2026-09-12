#!/usr/bin/env node
'use strict';

/**
 * Afiche Studio — CLI.
 * Only file that touches argv; all logic lives in src/.
 *
 *   afiche --list
 *   afiche --create mi-post
 *   afiche --preview mi-post
 *   afiche mi-post
 *   afiche mi-post --preset story --scale 3
 *   afiche --all
 */

const { Command } = require('commander');
const { exec } = require('child_process');
const path = require('path');

const {
  config, PRESETS, registry, creator, renderer, scaffold, browser,
} = require('../src');

const program = new Command();

program
  .name('afiche')
  .description('Promotional image generator (HTML/CSS -> PNG)')
  .version('1.0.0')
  .option('-l, --list',              'List all projects')
  .option('-c, --create <name>',     'Create a new project from the template')
  .option('-p, --preview',           'Open the project in the browser')
  .option('-a, --all',               'Render all projects')
  .option('--preset <name>',         `Format: ${Object.keys(PRESETS).join(', ')}`)
  .option('-w, --width <number>',    'Canvas width (px)', parseInt)
  .option('-H, --height <number>',   'Canvas height (px)', parseInt)
  .option('-s, --scale <number>',    'Scale factor (sharpness). Default 2', parseFloat)
  .option('-o, --output <name>',     'Output file name')
  .option('--app <dir>',             'Scaffold a project from an app folder (scans its global CSS)')
  .option('--json',                  'JSON output (for --list)');

program.parse();
const opt = program.opts();

/* ---------------------------------------------------------------- list */

function listProjects() {
  const projects = registry.list().map(name => registry.read(name));

  if (opt.json) {
    console.log(JSON.stringify(projects.map(p => ({
      name: p.name,
      title: p.config.title || null,
      preset: p.config.preset,
    })), null, 2));
    return;
  }

  if (!projects.length) {
    console.log('\nNo projects yet. Create the first one with:  afiche --create my-post\n');
    return;
  }

  console.log('\nAvailable projects:\n');
  for (const p of projects) {
    const dims = PRESETS[p.config.preset] || (p.config.width && p.config.height);
    const size = dims ? `${dims.width}x${dims.height}` : 'custom';
    console.log(`  ${p.name.padEnd(24)} ${String(p.config.title || 'untitled').padEnd(34)} ${size}`);
  }
  console.log('');
}

/* ---------------------------------------------------------------- create */

function createProject(rawName) {
  try {
    const { name, dir } = creator.create(rawName);
    console.log(`\nProject "${name}" created.\n`);
    console.log(`  Folder:   ${dir}`);
    console.log(`  Edit:     ${path.join(dir, 'index.html')}  (text, colors, layout)`);
    console.log(`  Settings: ${path.join(dir, 'config.json')}  (preset, scale, brand)`);
    console.log(`\n  Preview:      afiche --preview ${name}`);
    console.log(`  Generate PNG: afiche ${name}\n`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    if (err.code === 'EXISTS') {
      console.error('Available: ' + (registry.list().join(', ') || '(none)'));
    }
    process.exitCode = 1;
  }
}

/* ---------------------------------------------------------------- render */

async function renderProject(name) {
  const exists = registry.read(name);
  if (!exists) {
    console.error(`Error: project "${name}" does not exist. Create one with: afiche --create ${name}`);
    console.error(`Available: ${registry.list().join(', ') || '(none)'}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nRendering: ${exists.config.title || name}`);
  const out = await renderer.render({
    project: name,
    preset: opt.preset,
    width: opt.width,
    height: opt.height,
    scale: opt.scale,
    output: opt.output,
  });
  console.log(`  Canvas:   ${out.width}x${out.height}  (scale ${out.scale} => ${out.width * out.scale}x${out.height * out.scale} actual)`);
  console.log(`  Output:   ${out.file}`);
  console.log(`  OK: ${(out.bytes / 1024).toFixed(1)} KB`);
}

async function renderAll() {
  const projects = registry.list();
  if (!projects.length) { console.log('\nNo projects to render.\n'); return; }
  const made = [];
  for (const name of projects) {
    await renderProject(name);
    made.push(name);
  }
  console.log(`\nReady: ${made.length} images in ${config.OUTPUTS_DIR}\n`);
}

/* ---------------------------------------------------------------- preview */

function previewProject(name) {
  const found = registry.read(name);
  if (!found) {
    console.error(`Error: project "${name}" does not exist.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nOpening preview of "${name}"...\n  ${found.html}\n`);
  const file = found.html.replace(/\\/g, '/');
  const opener = process.platform === 'win32' ? `start "" "${found.html}"`
               : process.platform === 'darwin' ? `open "${file}"`
               : `xdg-open "${file}"`;
  exec(opener);
}

/* ---------------------------------------------------------------- scaffold */

function scaffoldProject(name, appPath) {
  try {
    const { dir, title, tokens } = scaffold({ name, appPath });
    const m = tokens.meta;
    console.log(`\nScaffolded "${name}" from ${appPath}\n`);
    console.log(`  ${m.cssFiles} css files \u00b7 ${m.styleBlocks} inline styles \u00b7 ${m.rootVars} root vars \u00b7 ${m.colorsFound} colors`);
    console.log(`  Accent:   ${tokens.colors.accent}`);
    console.log(`  Display:  ${tokens.fonts.display}  \u00b7  Body: ${tokens.fonts.body}`);
    console.log(`\n  "%s"\n`, title);
    console.log(`  Folder:   ${dir}`);
    console.log(`  Settings: ${dir}\\config.json`);
    console.log(`\n  Preview:      afiche --preview ${name}`);
    console.log(`  Generate PNG: afiche ${name}\n`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

/* ---------------------------------------------------------------- main */

async function main() {
  if (opt.list)         return listProjects();
  if (opt.create)       return createProject(opt.create);
  if (opt.all)          return renderAll();
  if (opt.app) {
    if (!program.args.length) { console.error('Error: specify the project name:  afiche <name> --app <dir>'); process.exitCode = 1; return; }
    return scaffoldProject(program.args[0], opt.app);
  }
  if (opt.preview) {
    if (!program.args.length) { console.error('Error: specify the project to preview.'); process.exitCode = 1; return; }
    return previewProject(program.args[0]);
  }
  if (program.args.length) return renderProject(program.args[0]);
  program.help();
}

main()
  .catch(err => { console.error('Render failed:', err.message); process.exitCode = 1; })
  .finally(() => browser.closeBrowser());   // otherwise the process would hang
