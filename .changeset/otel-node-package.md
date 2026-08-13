---
'@atproto/opentelemetry-node': minor
'@atproto/pds': patch
---

Extract the OpenTelemetry Node bootstrap out of the PDS into a new
`@atproto/opentelemetry-node` package. It exposes a `setup()` function from its
main entrypoint, plus three subpath entrypoints:

- `@atproto/opentelemetry-node/conventions` re-exports
  `@opentelemetry/semantic-conventions` alongside the atproto XRPC attribute keys.
- `@atproto/opentelemetry-node/instrumentation` exposes
  `getDefaultAtprotoInstrumentations()`, the instrumentations common to atproto
  services (which `setup()` registers automatically).
- `@atproto/opentelemetry-node/util` exposes the `extractNormalizedLxm()` helper.

As part of this move, the shared runtime instrumentation now enables
`captureUncaughtException`, so the PDS records uncaught exceptions as OTEL runtime
events when telemetry is enabled.
