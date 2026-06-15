#!/usr/bin/env node

/* eslint-env node */

// @NOTE This file exists as a .js file so that pnpm can properly link the "bin"
// scripts when the monorepo is being setup (during initial "pnpm install"), but
// was never built.

// @NOTE Self-referencing the package name (rather than importing
// "./dist/index.js") lets Node resolve through this package's own "exports"
// map. Under --conditions=typescript, that picks "./src/index.ts" so the CLI
// runs from source without a prior build. Otherwise it falls back to
// "./dist/index.js".

import '@atproto/lex-cli'
