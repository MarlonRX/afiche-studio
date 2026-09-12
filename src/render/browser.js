'use strict';

/**
 * Puppeteer singleton shared by the CLI and the server:
 * the browser is launched once per process and reused across renders.
 */

const puppeteer = require('puppeteer');

const ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--font-render-hinting=none',
  '--force-color-profile=srgb',
  '--disable-lcd-text',
];

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ headless: 'new', args: ARGS })
      .catch(err => { browserPromise = null; throw err; });
  }
  return browserPromise;
}

/** Safe to call when nothing was ever launched. */
async function closeBrowser() {
  if (!browserPromise) return;
  const pending = browserPromise;
  browserPromise = null;
  try { (await pending).close(); } catch { /* already gone */ }
}

module.exports = { getBrowser, closeBrowser };
