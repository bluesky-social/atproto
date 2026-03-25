/* eslint-env node */

import { type IncomingMessage } from 'node:http'
import { Span } from '@opentelemetry/api'
import { OTLPTraceExporter as OTLPGrpcTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { OTLPTraceExporter as OTLPHttpTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk'
import {
  ExpressInstrumentation,
  ExpressRequestInfo,
} from '@opentelemetry/instrumentation-express'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { BetterSqlite3Instrumentation } from 'opentelemetry-plugin-better-sqlite3'

type ExpressLikeRequest = IncomingMessage & {
  originalUrl?: string
}

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const otelExporterProtocol =
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL ||
    // Infer from default OTLP ports if not explicitly set
    (process.env.OTEL_EXPORTER_OTLP_ENDPOINT.includes(':4317')
      ? 'grpc'
      : process.env.OTEL_EXPORTER_OTLP_ENDPOINT.includes(':4318')
        ? 'http'
        : undefined)

  const traceExporter =
    otelExporterProtocol === 'grpc'
      ? new OTLPGrpcTraceExporter()
      : new OTLPHttpTraceExporter()

  const provider = new NodeTracerProvider({
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
  })

  provider.register()

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new ExpressInstrumentation({
        requestHook(
          span: Span,
          { request }: ExpressRequestInfo<ExpressLikeRequest>,
        ) {
          const url = request.originalUrl || request.url
          if (url?.startsWith('/xrpc/')) {
            const queryIndex = url.indexOf('?', 6)
            const nsid = url.slice(
              6,
              queryIndex === -1 ? undefined : queryIndex,
            )
            span.updateName(`XRPC ${nsid}`)
          }
        },
      }),
      new AwsInstrumentation(),
      new IORedisInstrumentation(),
      new HttpInstrumentation(),
      new UndiciInstrumentation(),
      new BetterSqlite3Instrumentation(),
      new PinoInstrumentation(),
    ],
  })
}
