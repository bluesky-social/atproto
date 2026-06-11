/* eslint-env node */

import { type IncomingMessage } from 'node:http'
import { Span, metrics } from '@opentelemetry/api'
import { OTLPMetricExporter as OTLPGrpcMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import { OTLPMetricExporter as OTLPHttpMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter as OTLPGrpcTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { OTLPTraceExporter as OTLPHttpTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { HostMetrics } from '@opentelemetry/host-metrics'
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
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
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

  const metricExporter =
    otelExporterProtocol === 'grpc'
      ? new OTLPGrpcMetricExporter()
      : new OTLPHttpMetricExporter()

  const provider = new NodeTracerProvider({
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
  })

  provider.register()

  const meterProvider = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
      }),
    ],
  })

  metrics.setGlobalMeterProvider(meterProvider)

  // process/runtime metrics (CPU, memory, event loop, GC)
  new HostMetrics({ meterProvider, name: 'pds' }).start()

  registerInstrumentations({
    tracerProvider: provider,
    meterProvider,
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
