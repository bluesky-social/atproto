/* eslint-env node */
/* eslint-disable import/order */

'use strict'

const { SpanKind, SpanStatusCode } = require('@opentelemetry/api')
const { registerInstrumentations } = require('@opentelemetry/instrumentation')
const sqlite = require('node:sqlite')
const { TracerProvider } = require('dd-trace') // Only works with commonjs
  .init({ logInjection: true })
  .use('express', {
    hooks: { request: maintainXrpcResource },
  })

const DB_SYSTEM = 'sqlite'
const ATTR_DB_SYSTEM = 'db.system'
const ATTR_DB_STATEMENT = 'db.statement'
const ATTR_DB_QUERY_TEXT = 'db.query.text'
const SQLITE_STMT_METHODS = ['all', 'get', 'run', 'iterate']

const tracer = new TracerProvider()
tracer.register()
instrumentNodeSqlite(tracer.getTracer('node:sqlite'))

registerInstrumentations({
  tracerProvider: tracer,
  instrumentations: [],
})

const path = require('node:path')

function maintainXrpcResource(span, req) {
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

function instrumentNodeSqlite(tracer) {
  const { DatabaseSync, StatementSync } = sqlite
  if (DatabaseSync.prototype.__pdsInstrumented) return
  Object.defineProperty(DatabaseSync.prototype, '__pdsInstrumented', {
    value: true,
  })

  const exec = DatabaseSync.prototype.exec
  DatabaseSync.prototype.exec = function (...params) {
    return traceSqlite(tracer, exec.name, params[0], () =>
      exec.apply(this, params),
    )
  }

  const prepare = DatabaseSync.prototype.prepare
  DatabaseSync.prototype.prepare = function (...params) {
    return traceSqlite(tracer, prepare.name, params[0], () =>
      prepare.apply(this, params),
    )
  }

  for (const method of SQLITE_STMT_METHODS) {
    const original = StatementSync.prototype[method]
    StatementSync.prototype[method] = function (...params) {
      return traceSqlite(tracer, original.name, this.sourceSQL, () =>
        original.apply(this, params),
      )
    }
  }
}

function traceSqlite(tracer, name, statement, fn) {
  const span = tracer.startSpan(name, {
    kind: SpanKind.CLIENT,
    attributes: {
      [ATTR_DB_SYSTEM]: DB_SYSTEM,
      [ATTR_DB_STATEMENT]: statement,
      [ATTR_DB_QUERY_TEXT]: statement,
    },
  })
  try {
    const result = fn()
    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (err) {
    span.recordException(err instanceof Error ? err : String(err))
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err instanceof Error ? err.message : undefined,
    })
    throw err
  } finally {
    span.end()
  }
}
