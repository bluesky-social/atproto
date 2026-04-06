/* eslint-env node */
/* eslint-disable import/no-dynamic-require */

'use strict'

const path = require('node:path')

// Run the PDS + PLC dev script (built from packages/dev-env/custom/run-pds-plc.ts)
require(
  path.join(
    __dirname,
    '../../packages/dev-env/dist/custom/custom/run-pds-plc.js',
  ),
)
