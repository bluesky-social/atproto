// A service telemetry module (see packages/pds/src/telemetry.ts), loaded with
// `node --import` ahead of the application. Imports this package by name, so
// from its build output.
import { setup } from '@atproto-labs/opentelemetry-node'
import { BetterSqlite3Instrumentation } from '@atproto-labs/opentelemetry-node/better-sqlite3-plugin'

await setup(() => ({
  name: 'test-service',
  version: '0.0.0',
  instrumentations: [new BetterSqlite3Instrumentation()],
}))
