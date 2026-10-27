import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { type OtlpCollector, startOtlpCollector } from './_otlp-collector.js'

/**
 * Runs `app` the way atproto services run: in a Node.js process that loads a
 * telemetry module calling setup() with `--import`, and exits by emptying its
 * event loop (which flushes telemetry on "beforeExit").
 *
 * @note This needs a separate process: vitest imports external modules by
 * their resolved file URL, which import-in-the-middle (matching on bare
 * specifiers) does not hook, so ESM imports can't be instrumented in-process.
 * The telemetry fixture loads this package from "./dist": build it first.
 */
async function runService(collector: OtlpCollector, app: string) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('OTEL_')),
  )
  const child = spawn(
    process.execPath,
    ['--import', fixturePath('telemetry.mjs'), fixturePath(app)],
    { env: { ...env, ...collector.env }, stdio: 'inherit' },
  )
  const [code] = await once(child, 'exit')
  expect(code).toBe(0)
}

function fixturePath(name: string) {
  return fileURLToPath(new URL(`./_fixtures/${name}`, import.meta.url))
}

// opentelemetry-plugin-better-sqlite3 depends on its own (older)
// @opentelemetry/instrumentation. This fails unless it shares the SDK's
// import-in-the-middle copy, and setup() opened the loader hook's message
// channel before constructing it.
test('better-sqlite3 queries are traced', async () => {
  await using collector = await startOtlpCollector()

  await runService(collector, 'better-sqlite3-app.mjs')

  expect(
    collector.spans('opentelemetry-instrumentation-better-sqlite3'),
  ).toMatchObject([
    {
      name: 'SELECT',
      attributes: expect.arrayContaining([
        { key: 'db.query.text', value: { stringValue: 'SELECT 1' } },
      ]),
    },
  ])
})
