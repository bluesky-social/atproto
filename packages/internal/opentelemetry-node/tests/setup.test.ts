import { SeverityNumber, logs, trace } from '@opentelemetry/api'
import { afterAll, expect, test, vi } from 'vitest'
import { ATTR_SERVICE_NAME } from '../src/conventions.js'
import { setup } from '../src/index.js'
import { startOtlpCollector } from './_otlp-collector.js'

// @note setup() patches process-wide state (OTEL globals, module loader hooks),
// so it can only run once per test file.

afterAll(() => {
  logs.disable()
  trace.disable()
  vi.unstubAllEnvs()
})

// Services emit their events through @opentelemetry/api (see their events.ts).
// This fails if the SDK registers its logger provider anywhere else (e.g. the
// former @opentelemetry/api-logs global).
test('log records emitted through @opentelemetry/api are exported', async () => {
  await using collector = await startOtlpCollector()
  for (const [name, value] of Object.entries(collector.env)) {
    vi.stubEnv(name, value)
  }

  await setup(() => ({ name: 'test-service', version: '0.0.0' }))

  logs.getLogger('test-logger').emit({
    eventName: 'test.event',
    severityNumber: SeverityNumber.INFO,
    body: 'hello',
  })

  await forceFlush(logs.getLoggerProvider())

  expect(collector.logRecords('test-logger')).toMatchObject([
    {
      resource: {
        attributes: expect.arrayContaining([
          { key: ATTR_SERVICE_NAME, value: { stringValue: 'test-service' } },
        ]),
      },
      record: {
        eventName: 'test.event',
        severityNumber: SeverityNumber.INFO,
        body: { stringValue: 'hello' },
      },
    },
  ])
})

/**
 * Exports what the SDK provider registered by {@link setup} has buffered. The
 * API only exposes it through its own types, hence the duck typing. When the
 * SDK did not register it, the API returns a no-op provider and this does
 * nothing.
 */
async function forceFlush(provider: object): Promise<void> {
  await (provider as { forceFlush?: () => Promise<void> }).forceFlush?.()
}
