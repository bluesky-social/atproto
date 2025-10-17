'use strict'

/* eslint-env commonjs */

// The purpose of this file is to allow accessing "@atproto/lex/doc" when not
// using node16+ module resolution.

Object.defineProperty(exports, '__esModule', { value: true })

const tslib = require('tslib')

tslib.__exportStar(require('./dist/doc/doc.js'), exports)
