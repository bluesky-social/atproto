import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import pkg from '@atproto/pds/package.json' with { type: 'json' }
import { setup } from '@atproto-labs/opentelemetry-node'
import { BetterSqlite3Instrumentation } from '@atproto-labs/opentelemetry-node/better-sqlite3-plugin'

await setup(() => ({
  name: pkg.name,
  version: pkg.version,
  instrumentations: [
    new AwsInstrumentation(),
    new IORedisInstrumentation(),
    new BetterSqlite3Instrumentation(),
  ],
}))
