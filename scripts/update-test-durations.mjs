#!/usr/bin/env node

// Refreshes vitest.integration.durations.json, which vitest.integration.config.ts
// uses to balance the CI shards of "pnpm test:integration", from the per-file
// durations that a "Repository CI" run uploads (one file per "Test (k/8)" job):
//
//   node scripts/update-test-durations.mjs <run-id>
//
// Pick a recent green run: a failing file's duration isn't representative. A
// file's duration also depends on what runs next to it, so each refresh
// averages the run's measure with the recorded one, smoothing out that noise.
// Files the run didn't have (deleted ones) are dropped.

import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const runId = process.argv[2]
if (!runId) {
  console.error('usage: node scripts/update-test-durations.mjs <run-id>')
  process.exit(1)
}

const root = resolve(import.meta.dirname, '..')
const file = join(root, 'vitest.integration.durations.json')
const recorded = JSON.parse(readFileSync(file, 'utf8'))
const dir = mkdtempSync(join(tmpdir(), 'vitest-durations-'))

try {
  execFileSync(
    'gh',
    ['run', 'download', runId, '--pattern', 'vitest-durations-*', '--dir', dir],
    { stdio: 'inherit' },
  )

  const durations = {}
  for (const artifact of readdirSync(dir)) {
    Object.assign(
      durations,
      JSON.parse(
        readFileSync(join(dir, artifact, 'vitest-durations.json'), 'utf8'),
      ),
    )
  }

  const sorted = Object.fromEntries(
    Object.entries(durations)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([path, duration]) => [
        path,
        path in recorded
          ? Math.round((recorded[path] + duration) * 5) / 10
          : duration,
      ]),
  )
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`Recorded the durations of ${Object.keys(sorted).length} files`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
