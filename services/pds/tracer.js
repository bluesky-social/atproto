/* eslint-env node */

'use strict'

/** @typedef {import('express').Request} Request */

const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http')
const { registerInstrumentations } = require('@opentelemetry/instrumentation')
const { AwsInstrumentation } = require('@opentelemetry/instrumentation-aws-sdk')
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

const provider = new NodeTracerProvider({
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
})

provider.register()

registerInstrumentations({
  tracerProvider: provider,
  instrumentations: [
    new ExpressInstrumentation({ requestHook }),
    new AwsInstrumentation(),
    new IORedisInstrumentation(),
    new HttpInstrumentation(),
    new UndiciInstrumentation(),
    new BetterSqlite3Instrumentation(),
    new PinoInstrumentation(),
  ],
})

/**
 * @param {import('@opentelemetry/api').Span} span
 * @param {import('@opentelemetry/instrumentation-express').ExpressRequestInfo<Request>} info
 */
function requestHook(span, { request }) {
  const url = request.originalUrl || request.url
  if (url?.startsWith('/xrpc/')) {
    const queryIndex = url.indexOf('?', 6)
    const nsid = url.slice(6, queryIndex === -1 ? undefined : queryIndex)
    span.updateName(nsid)
  }
}
