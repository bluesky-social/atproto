---
'@atproto/ozone': patch
'@atproto-labs/opentelemetry-node': patch
---

Align Ozone telemetry with the shared OpenTelemetry bootstrap and add Undici tracing while retaining PostgreSQL instrumentation. Restrict the shared ESM loader hook to instrumented modules.
