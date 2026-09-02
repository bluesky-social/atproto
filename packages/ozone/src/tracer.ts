// Opt-in OpenTelemetry tracing. Load via `node --import @atproto/ozone/tracer`
// (or `--import ./tracer.ts` from the service entrypoint) so module patching is
// in place before the application code is resolved — instrumentation hooked any
// later cannot patch http/express/pg, which is why this cannot live inside
// main() as a regular function call.
//
// Tracing is off unless an OTLP endpoint is configured, so deployments that
// don't run a collector (e.g. the self-hosted ozone-ui docker distribution) pay
// no overhead and see no exporter noise. All standard OTEL_* env vars are
// honored (OTEL_SERVICE_NAME, OTEL_TRACES_SAMPLER, OTEL_TRACES_SAMPLER_ARG,
// OTEL_RESOURCE_ATTRIBUTES, ...); sampling defaults to parent-based always-on.
import { register } from 'node:module'

const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT

if (otlpEndpoint) {
  // ESM loader hook, required for instrumentation of ES modules. Registered
  // before the SDK imports below so it is in place for everything after us.
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)

  // Imported lazily so that when tracing is disabled the OTel SDK is never
  // loaded at all.
  const { OTLPTraceExporter } =
    await import('@opentelemetry/exporter-trace-otlp-http')
  const { ExpressInstrumentation } =
    await import('@opentelemetry/instrumentation-express')
  const { HttpInstrumentation } =
    await import('@opentelemetry/instrumentation-http')
  const { PgInstrumentation } =
    await import('@opentelemetry/instrumentation-pg')
  const { PinoInstrumentation } =
    await import('@opentelemetry/instrumentation-pino')
  const { NodeSDK } = await import('@opentelemetry/sdk-node')

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'ozone',
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      // Inbound/outbound http spans. XRPC methods are registered as literal
      // express routes (/xrpc/<nsid>), so span names carry the actual method
      // nsid without any renaming hook.
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PgInstrumentation(),
      // Injects trace_id/span_id into pino log lines for log↔trace correlation.
      new PinoInstrumentation(),
    ],
  })

  sdk.start()

  // Flush buffered spans before exit. The entrypoints also handle SIGTERM for
  // their own teardown; multiple listeners run independently.
  process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => {})
  })
}
