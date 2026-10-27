import { afterAll, expect, test, vi } from 'vitest'
import {
  type Instrumentation,
  InstrumentationMismatchError,
  setup,
} from '../src/index.js'

// @note setup() patches process-wide state (module loader hooks), so it can
// only run once per test file.

afterAll(() => {
  vi.unstubAllEnvs()
})

test('setup() rejects instrumentations built on another @opentelemetry/instrumentation copy', async () => {
  vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', 'http://127.0.0.1:1')

  // Shaped like an InstrumentationBase, but not an instance of ours
  const foreign = {
    instrumentationName: 'foreign-instrumentation',
    getModuleDefinitions: () => [],
  } as unknown as Instrumentation

  const result = setup(() => ({
    name: 'test-service',
    version: '0.0.0',
    instrumentations: [foreign],
  }))

  await expect(result).rejects.toThrow(InstrumentationMismatchError)
  await expect(result).rejects.toThrow('"foreign-instrumentation"')
})
