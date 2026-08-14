---
'@atproto-labs/opentelemetry-node': minor
'@atproto/pds': patch
---

Extract the OpenTelemetry Node bootstrap out of the PDS into a new
`@atproto-labs/opentelemetry-node` package. It exposes a `setup()` function from
its main entrypoint, plus two subpath entrypoints:

- `@atproto-labs/opentelemetry-node/conventions` re-exports
  `@opentelemetry/semantic-conventions` alongside the atproto XRPC attribute keys.
- `@atproto-labs/opentelemetry-node/instrumentation` exposes
  `getDefaultAtprotoInstrumentations()`, the instrumentations common to atproto
  services (which `setup()` registers automatically).

As part of this move, the shared runtime instrumentation now enables
`captureUncaughtException`, so the PDS records uncaught exceptions as OTEL runtime
events when telemetry is enabled.
