// Opt-in OpenTelemetry tracing, loaded via `node --import` (see Dockerfile CMD)
// so instrumentation is registered before any application module is resolved.
// No-op unless OTEL_EXPORTER_OTLP_ENDPOINT (or the _TRACES_ variant) is set —
// see the module itself for details and supported env vars.
import '@atproto/ozone/telemetry'
