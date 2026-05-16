#!/usr/bin/env node

/* eslint-env node */

// @NOTE This file exists so that pnpm can properly link the "bin" scripts when
// the monorepo is being setup (during initial "pnpm install"), but was never
// built.

import './dist/index.js'
