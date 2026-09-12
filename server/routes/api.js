'use strict';

/**
 * JSON API consumed by the editor client:
 *
 *   GET  /api/meta                 -> projects + presets
 *   GET  /api/project/<name>       -> project file (?file=, default index.html)
 *   PUT  /api/project/<name>       -> save file (broadcasts reload)
 *   GET  /api/preset/<name>        -> master variant of the project
 *   POST /api/create               -> new project from template
 *   POST /api/scaffold             -> new project from an app's global CSS
 *   POST /api/export               -> render PNG/WEBP/JPG variants
 */

const fs = require('fs');
const path = require('path');
const { PRESETS, registry, creator, renderer, scaffold } = require('../../src');
const { broadcast } = require('./sse');
const { send, sendJson, readBody, MIME } = require('../http-utils');

/** Only these files of a project are editable through the API. */
const EDITABLE = new Set(['index.html', 'styles.css']);

/** Resolve an editable project file, or null when the name is rejected. */
function projectFile(found, raw) {
  const rel = raw || 'index.html';
  if (!EDITABLE.has(rel)) return null;
  return path.join(found.dir, rel);
}

/** @returns {Promise<boolean>} true when the request was an API call. */
async function handle(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api') return false;

  const [, action, arg] = parts;
  const name = arg ? decodeURIComponent(arg) : null;
  const key = `${req.method} ${action}`;

  if (key === 'GET meta')        return meta(res);
  if (key === 'GET project')     return getProject(res, name, url);
  if (key === 'PUT project')     return await putProject(req, res, name, url);
  if (key === 'GET preset')      return getPreset(res, name);
  if (key === 'POST create')     return await create(req, res);
  if (key === 'POST scaffold')   return await scaffoldProject(req, res);
  if (key === 'POST export')     return await exportVariants(req, res);

  sendJson(res, 404, { error: `unknown api call: ${action || '/'}` });
  return true;
}

/* ---------------------------------------------------------------- meta */

function meta(res) {
  sendJson(res, 200, { projects: registry.list(), presets: PRESETS });
  return true;
}

/* ---------------------------------------------------------------- project */

function getProject(res, name, url) {
  const found = registry.read(name);
  const file = found && projectFile(found, url.searchParams.get('file'));
  if (!file || !fs.existsSync(file)) { sendJson(res, 404, { error: 'not found' }); return true; }
  const ext = path.extname(file);
  send(res, 200, fs.readFileSync(file), { 'Content-Type': MIME[ext] || MIME['.html'] });
  return true;
}

async function putProject(req, res, name, url) {
  const found = registry.read(name);
  const file = found && projectFile(found, url.searchParams.get('file'));
  if (!file) { sendJson(res, 404, { error: 'not found' }); return true; }

  const body = await readBody(req);
  fs.writeFileSync(file, body, 'utf8');
  broadcast('reload', name);
  sendJson(res, 200, { ok: true, bytes: Buffer.byteLength(body) });
  return true;
}

function getPreset(res, name) {
  const found = registry.read(name);
  if (!found) { sendJson(res, 404, { error: 'not found' }); return true; }
  sendJson(res, 200, { preset: found.config.preset });
  return true;
}

/* ---------------------------------------------------------------- create */

async function create(req, res) {
  const body = JSON.parse((await readBody(req)) || '{}');
  try {
    const { name } = creator.create(body.name);
    sendJson(res, 200, { ok: true, name });
  } catch (err) {
    const status = { INVALID_NAME: 400, EXISTS: 409 }[err.code] || 500;
    sendJson(res, status, { error: err.message });
  }
  return true;
}

/* ---------------------------------------------------------------- scaffold */

async function scaffoldProject(req, res) {
  const body = JSON.parse((await readBody(req, 25e6)) || '{}');   // uploads may be sizable
  try {
    const result = scaffold({
      name: body.name,
      appPath: body.appPath,
      files: body.files,
      title: body.title,
    });
    sendJson(res, 200, {
      ok: true,
      name: result.name,
      title: result.title,
      tokens: result.tokens,
    });
  } catch (err) {
    const status = {
      INVALID_NAME: 400, EXISTS: 409,
      PATH_NOT_FOUND: 400, PATH_NOT_DIR: 400, NO_CSS: 422,
    }[err.code] || 500;
    sendJson(res, status, { error: err.message });
  }
  return true;
}

/* ---------------------------------------------------------------- export */

async function exportVariants(req, res) {
  const body = JSON.parse((await readBody(req)) || '{}');
  const found = registry.read(body.project);
  if (!found) { sendJson(res, 404, { error: 'project not found' }); return true; }

  const formats = (Array.isArray(body.formats) && body.formats.length ? body.formats : ['png'])
    .filter(f => ['png', 'webp', 'jpg'].includes(f));
  const variants = (Array.isArray(body.presets) && body.presets.length ? body.presets : ['post'])
    .filter(p => PRESETS[p]);
  const scale = Math.min(Math.max(parseFloat(body.scale) || 2, 1), 4);

  const outputs = [];
  for (const preset of variants) {
    for (const format of formats) {
      const out = await renderer.render({ project: found.name, preset, scale, format });
      outputs.push({
        file: out.name,
        url: `/outputs/${encodeURIComponent(out.name)}`,
        preset, format,
        kb: (out.bytes / 1024).toFixed(0),
      });
    }
  }
  sendJson(res, 200, { ok: true, outputs });
  return true;
}

module.exports = { handle };
