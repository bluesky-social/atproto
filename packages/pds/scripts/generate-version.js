#!/usr/bin/env node
/**
 * Generate version.ts with git commit hash and build timestamp
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

try {
  const gitHash = execSync('git rev-parse --short HEAD', {
    encoding: 'utf8',
  }).trim()
  const gitHashFull = execSync('git rev-parse HEAD', {
    encoding: 'utf8',
  }).trim()
  const buildTime = new Date().toISOString()

  const content = `/**
 * Auto-generated file - DO NOT EDIT
 * Generated at build time by scripts/generate-version.js
 */

export const BUILD_HASH = '${gitHash}'
export const BUILD_HASH_FULL = '${gitHashFull}'
export const BUILD_TIME = '${buildTime}'
`

  const outputPath = path.join(__dirname, '../src/version.ts')
  fs.writeFileSync(outputPath, content, 'utf8')

  console.log(`Generated version.ts with hash ${gitHash}`)
} catch (error) {
  console.warn('Warning: Could not generate version info:', error.message)

  // Create fallback version file
  const content = `/**
 * Auto-generated file - DO NOT EDIT
 * Generated at build time by scripts/generate-version.js
 */

export const BUILD_HASH = 'unknown'
export const BUILD_HASH_FULL = 'unknown'
export const BUILD_TIME = '${new Date().toISOString()}'
`

  const outputPath = path.join(__dirname, '../src/version.ts')
  fs.writeFileSync(outputPath, content, 'utf8')

  console.log('Generated version.ts with fallback values')
}
