---
'@atproto/xrpc-server': patch
'@atproto/ozone': patch
---

Add opt-in prometheus metrics server and opt-in OpenTelemetry tracing (via `@atproto/ozone/tracer`, gated on `OTEL_EXPORTER_OTLP_ENDPOINT`) to ozone; the ozone service image now uses OpenTelemetry instead of dd-trace
