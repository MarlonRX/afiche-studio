'use strict';

/**
 * Public exports of the core. No HTTP, no argv in here:
 * cli/ and server/ are thin layers on top of this module.
 *
 *   const { registry, creator, renderer, PRESETS } = require('./src');
 */

module.exports = {
  config: require('./config'),

  // formats and defaults (single source of truth)
  ...require('./presets'),

  // projects
  registry: require('./projects/registry'),
  creator: require('./projects/creator'),

  // scaffold: generate a poster from an app's global CSS
  scaffold: require('./scaffold').scaffold,

  // rendering
  renderer: require('./render/renderer'),
  browser: require('./render/browser'),
};
