'use strict';

/**
 * Global config: paths and port.
 * Everything derives from ROOT so CLI and server always agree on locations.
 */

const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  ROOT,
  PROJECTS_DIR: path.join(ROOT, 'projects'),
  OUTPUTS_DIR: path.join(ROOT, 'outputs'),
  TEMPLATES_DIR: path.join(ROOT, 'templates'),
  SHARED_DIR: path.join(ROOT, 'shared'),
  PUBLIC_DIR: path.join(ROOT, 'server', 'public'),
  PORT: parseInt(process.env.PORT || '4560', 10),
};
