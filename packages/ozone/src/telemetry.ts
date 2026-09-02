import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'
import pkg from '@atproto/ozone/package.json' with { type: 'json' }
import { setup } from '@atproto-labs/opentelemetry-node'

setup(() => ({
  name: pkg.name,
  version: pkg.version,
  instrumentations: [new PgInstrumentation()],
}))
