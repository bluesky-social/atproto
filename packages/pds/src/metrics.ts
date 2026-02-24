import client, { Registry } from 'prom-client'
import express from 'express'

const register = new Registry()

// Node.js default metrics (event loop lag, heap, GC)
client.collectDefaultMetrics({ register })

// --- HTTP ---

const httpRequestDuration = new client.Histogram({
  name: 'pds_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
})

const httpRequestsTotal = new client.Counter({
  name: 'pds_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
})

// --- SQLite ---

export const sqliteQueryDuration = new client.Histogram({
  name: 'pds_sqlite_query_duration_seconds',
  help: 'SQLite query duration in seconds',
  labelNames: ['database'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
})

// --- Business ---

export const activeAccountsGauge = new client.Gauge({
  name: 'pds_active_accounts_total',
  help: 'Number of active accounts',
  registers: [register],
})

export const repoOperationsTotal = new client.Counter({
  name: 'pds_repo_operations_total',
  help: 'Total repo operations',
  labelNames: ['operation'] as const,
  registers: [register],
})

// --- Middleware ---

export function metricsMiddleware(): express.RequestHandler {
  return (req, res, next) => {
    const start = process.hrtime.bigint()
    res.on('finish', () => {
      const durationNs = Number(process.hrtime.bigint() - start)
      const durationS = durationNs / 1e9
      const route = req.route?.path ?? req.path
      const labels = {
        method: req.method,
        route,
        status_code: res.statusCode,
      }
      httpRequestDuration.observe(labels, durationS)
      httpRequestsTotal.inc(labels)
    })
    next()
  }
}

// --- Endpoint ---

export async function getMetrics(): Promise<string> {
  return register.metrics()
}

export function getContentType(): string {
  return register.contentType
}
