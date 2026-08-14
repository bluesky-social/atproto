import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'
import { setup } from '@atproto-labs/opentelemetry-node'
import pkg from '@atproto/pds/package.json' with { type: 'json' }

setup(() => ({
  name: pkg.name,
  version: pkg.version,
  instrumentations: [
    new AwsInstrumentation(),
    new IORedisInstrumentation(),
    new BetterSqlite3Instrumentation(),
  ],
}))
