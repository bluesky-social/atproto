// Registers dd-trace's ESM loader hook for the rest of the process. Must be the
// first import so the hook is in place before any other module is resolved.
import 'dd-trace/register.js'
import path from 'node:path'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import ddTrace from 'dd-trace'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'

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
