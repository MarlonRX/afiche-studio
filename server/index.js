#!/usr/bin/env node
'use strict';

/**
 * Afiche Studio — dev server bootstrap.
 *
 *   npm run dev   =>  http://localhost:4560
 *
 * This file only wires routes; each one owns its own slice:
 *   routes/sse.js     live reload (EventSource)
 *   routes/api.js     JSON API used by the editor client
 *   routes/static.js  editor assets + project canvases + outputs
 *
 * The server operates on the same projects/ as the CLI: what you save
 * here is exactly what `afiche <project>` renders later.
 */

const http = require('http');
const fs = require('fs');
const { execFile } = require('child_process');

const { config, browser } = require('../src');
const { sendJson } = require('./http-utils');
const sse = require('./routes/sse');
const api = require('./routes/api');
const staticRoutes = require('./routes/static');

const ROUTES = [sse, api, staticRoutes];   // first match wins

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${config.PORT}`);
  try {
    for (const route of ROUTES) {
      if (await route.handle(req, res, url)) return;
    }
    sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(`[afiche] ${req.method} ${url.pathname} ->`, err.message);
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
    else res.end();
  }
});

function tryOpenBrowser(target) {
  const wrapper = 'C:/Users/marlon/Helena/open-url.sh';
  let cmd, args;
  if (process.platform === 'win32' && fs.existsSync(wrapper)) {
    cmd = 'bash'; args = [wrapper, target];                 // single-tab helper
  } else if (process.platform === 'win32') {
    cmd = 'cmd'; args = ['/c', 'start', '', target];
  } else if (process.platform === 'darwin') {
    cmd = 'open'; args = [target];
  } else {
    cmd = 'xdg-open'; args = [target];
  }
  execFile(cmd, args, () => {});
}

server.listen(config.PORT, () => {
  const url = `http://localhost:${config.PORT}`;
  console.log(`\n  Afiche Studio — dev server`);
  console.log(`  Editor:    ${url}  (single tab)`);
  console.log(`  Projects:  ${config.PROJECTS_DIR}`);
  console.log(`  Renders:   ${config.OUTPUTS_DIR}\n`);
  if (!process.env.AFICHE_NO_OPEN) tryOpenBrowser(url);
});

process.on('SIGINT', async () => {
  await browser.closeBrowser();
  server.close();
  process.exit(0);
});
