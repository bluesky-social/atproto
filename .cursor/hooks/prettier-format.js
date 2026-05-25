#!/usr/bin/env node
/**
 * afterFileEdit hook — runs Prettier on the file the agent just wrote.
 * Supports Write and StrReplace tool events.
 * Skips files Prettier doesn't know about (e.g. lock files, binaries).
 */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const PRETTIER_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.yaml',
  '.yml',
  '.css',
])

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  input += chunk
})
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input)
    const filePath = event?.input?.path
    if (!filePath) process.exit(0)

    const ext = path.extname(filePath).toLowerCase()
    if (!PRETTIER_EXTENSIONS.has(ext)) process.exit(0)

    // Resolve to absolute path if needed
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath)

    if (!fs.existsSync(absPath)) process.exit(0)

    const prettierBin = path.join(
      process.cwd(),
      'node_modules',
      'prettier',
      'bin',
      'prettier.cjs',
    )
    if (!fs.existsSync(prettierBin)) process.exit(0)

    execSync(`node "${prettierBin}" --write "${absPath}"`, { stdio: 'ignore' })
  } catch (_) {
    // Fail open — never block the agent
  }
  process.exit(0)
})
