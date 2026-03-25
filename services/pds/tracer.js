/* eslint-env node */
/* eslint-disable n/global-require */

'use strict'

/** @typedef {import('express').Request} Request */
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const {
    OTLPTraceExporter: OTLPGrpcTraceExporter,
  } = require('@opentelemetry/exporter-trace-otlp-grpc')
  const {
    OTLPTraceExporter: OTLPHttpTraceExporter,
  } = require('@opentelemetry/exporter-trace-otlp-http')
  const { registerInstrumentations } = require('@opentelemetry/instrumentation')
  const {
    AwsInstrumentation,
  } = require('@opentelemetry/instrumentation-aws-sdk')
  const {
    ExpressInstrumentation,
  } = require('@opentelemetry/instrumentation-express')
  const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
  const {
    IORedisInstrumentation,
  } = require('@opentelemetry/instrumentation-ioredis')
  const { PinoInstrumentation } = require('@opentelemetry/instrumentation-pino')
  const {
    UndiciInstrumentation,
  } = require('@opentelemetry/instrumentation-undici')
  const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base')
  const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node')
  const {
    BetterSqlite3Instrumentation,
  } = require('opentelemetry-plugin-better-sqlite3')

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
        /**
         * @param {import('@opentelemetry/api').Span} span
         * @param {import('@opentelemetry/instrumentation-express').ExpressRequestInfo<Request>} info
         */
        requestHook(span, { request }) {
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
