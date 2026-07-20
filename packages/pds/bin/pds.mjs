#!/usr/bin/env node

/* eslint-env node */

// This file is referenced by the "bin" field in package.json. Because of that,
// we need this file to exist on disk before the project is built. This allows
// package managers to properly link the CLI command when the monorepo is being
// setup (during initial "pnpm install" from the repo root).

import { PDS } from '@atproto/pds'

const abortController = new AbortController()

/** @param {string} eventName */
function shutdown() {
  // Remove the listeners, which should cause NodeJS's default behavior to kick
  // in and exit the process with a non-zero code if triggered again.
  process.off('SIGINT', shutdown)
  process.off('SIGTERM', shutdown)

  abortController.abort()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// @NOTE Will trigger "unhandledRejection" if the promise rejects, which will
// cause NodeJS to exit with a non-zero code.
void PDS.run(abortController.signal)
