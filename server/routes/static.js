'use strict';

/**
 * Static files:
 *
 *   /                    -> editor UI (public/index.html)
 *   /editor.css, /editor.js, /components/*.js -> editor client
 *   /proj/<name>/...     -> a project's canvas (what the iframe loads)
 *   /shared/...          -> browser runtime of the canvases (css + js)
 *   /templates/...       -> base template assets
 *   /outputs/<file>      -> generated renders (download links)
 */

const path = require('path');
const { config, registry } = require('../../src');
const { send, safeJoin, serveFile } = require('../http-utils');

/** @returns {boolean} true when this module answered. */
function handle(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  const parts = url.pathname.split('/').filter(Boolean);

  /* Editor UI */
  if (!parts.length || parts[0] === 'index.html') {
    return serveFile(res, path.join(config.PUBLIC_DIR, 'index.html'));
  }

  /* A project's canvas: /proj/<name>/... served from projects/ */
  if (parts[0] === 'proj') {
    const rel = url.pathname.replace(/^\/proj\/[^/]+/, '');
    const base = registry.paths(decodeURIComponent(parts[1] || '')).dir;
    return done(serveFile(res, safeJoin(base, rel)));
  }

  /* Shared runtime and template assets (used by the canvases) */
  if (parts[0] === 'shared' || parts[0] === 'templates') {
    return done(serveFile(res, safeJoin(config.ROOT, url.pathname)));
  }

  /* Download of the generated renders */
  if (parts[0] === 'outputs') {
    return done(serveFile(res, safeJoin(config.OUTPUTS_DIR, decodeURIComponent(parts[1] || ''))));
  }

  /* Anything else that exists under public/ (editor.css, components/...) */
  return done(serveFile(res, safeJoin(config.PUBLIC_DIR, decodeURIComponent(url.pathname))));

  function done(handled) {
    if (!handled) send(res, 404, 'not found');
    return true;   // this module owns GETs that reach it
  }
}

module.exports = { handle };
