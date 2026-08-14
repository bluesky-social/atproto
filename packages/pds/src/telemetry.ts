import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'
import pkg from '@atproto/pds/package.json' with { type: 'json' }
import { setup } from '@atproto-labs/opentelemetry-node'

setup(() => ({
  name: pkg.name,
  version: pkg.version,
  instrumentations: [
    new AwsInstrumentation(),
    new IORedisInstrumentation(),
    new BetterSqlite3Instrumentation(),
  ],
}))
