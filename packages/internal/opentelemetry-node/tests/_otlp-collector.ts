import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

// Subset of the OTLP/HTTP JSON export requests
// https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding
type KeyValue = { key: string; value: { stringValue?: string } }
type Resource = { attributes: KeyValue[] }
type LogRecord = {
  eventName?: string
  severityNumber?: number
  body?: { stringValue?: string }
}
type Span = { name: string; attributes: KeyValue[] }
type ExportLogsRequest = {
  resourceLogs: Array<{
    resource: Resource
    scopeLogs: Array<{ scope: { name: string }; logRecords: LogRecord[] }>
  }>
}
type ExportTracesRequest = {
  resourceSpans: Array<{
    resource: Resource
    scopeSpans: Array<{ scope: { name: string }; spans: Span[] }>
  }>
}

export type OtlpCollector = Awaited<ReturnType<typeof startOtlpCollector>>

/**
 * In-process OTLP/HTTP collector, recording what the SDK exports (with the
 * "http/json" protocol) for later inspection.
 */
export async function startOtlpCollector() {
  const logRequests: ExportLogsRequest[] = []
  const traceRequests: ExportTracesRequest[] = []

  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString())
    if (req.url === '/v1/logs') logRequests.push(body)
    if (req.url === '/v1/traces') traceRequests.push(body)
    res.writeHead(200, { 'content-type': 'application/json' }).end('{}')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  const origin = `http://127.0.0.1:${port}`

  return {
    /** `OTEL_*` variables exporting logs and traces to this collector */
    env: {
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${origin}/v1/logs`,
      OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'http/json',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `${origin}/v1/traces`,
      OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: 'http/json',
      // Keep resource detection local (no cloud metadata lookups)
      OTEL_NODE_RESOURCE_DETECTORS: 'none',
    },

    /** Exported log records of the given instrumentation scope */
    logRecords(scopeName: string) {
      return logRequests.flatMap((req) =>
        req.resourceLogs.flatMap(({ resource, scopeLogs }) =>
          scopeLogs
            .filter(({ scope }) => scope.name === scopeName)
            .flatMap(({ logRecords }) =>
              logRecords.map((record) => ({ resource, record })),
            ),
        ),
      )
    },

    /** Exported spans of the given instrumentation scope */
    spans(scopeName: string) {
      return traceRequests.flatMap((req) =>
        req.resourceSpans.flatMap(({ scopeSpans }) =>
          scopeSpans
            .filter(({ scope }) => scope.name === scopeName)
            .flatMap(({ spans }) => spans),
        ),
      )
    },

    async [Symbol.asyncDispose]() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    },
  }
}
