# @atproto-labs/opentelemetry-node

## 0.1.0

### Minor Changes

- [#5397](https://github.com/bluesky-social/atproto/pull/5397) [`aff31c8`](https://github.com/bluesky-social/atproto/commit/aff31c815dd69168f3529e667e8bc6e61272bc63) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Extract the OpenTelemetry Node bootstrap out of the PDS into a new
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
