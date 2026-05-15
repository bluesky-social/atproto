/* eslint-disable import/order */
import { createRequire } from 'node:module'
import path from 'node:path'

import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'

const require = createRequire(import.meta.url)
const ddTrace = require('dd-trace')

const { TracerProvider } = ddTrace.init({ logInjection: true }).use('express', {
  hooks: { request: maintainXrpcResource },
})

const tracer = new TracerProvider()
tracer.register()

registerInstrumentations({
  tracerProvider: tracer,
  instrumentations: [new BetterSqlite3Instrumentation()],
})

function maintainXrpcResource(span: any, req: any) {
  // Show actual xrpc method as resource rather than the route pattern
  if (span && req.originalUrl?.startsWith('/xrpc/')) {
    span.setTag(
      'resource.name',
      [
        req.method,
        path.posix.join(req.baseUrl || '', req.path || '', '/').slice(0, -1), // Ensures no trailing slash
      ]
        .filter(Boolean)
        .join(' '),
    )
  }
}
