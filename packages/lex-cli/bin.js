#!/usr/bin/env node

/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */

'use strict'

// @NOTE This file exists so that pnpm can properly link the `lex` CLI command
// when the monorepo is being setup (during initial "pnpm install").

require('./dist/index.js')
