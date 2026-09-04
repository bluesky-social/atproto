# @atproto-labs/opentelemetry-node

## 0.2.0

### Minor Changes

- [#5472](https://github.com/bluesky-social/atproto/pull/5472) [`222f4bc`](https://github.com/bluesky-social/atproto/commit/222f4bc600fb89c75fafee95ef3c837b1721601e) Thanks [@rafaeleyng](https://github.com/rafaeleyng)! - Move the RPC telemetry constants shared by both halves of a bsync call into `@atproto-labs/opentelemetry-node`: the `bsync.namespace` and `bsync.operation` attribute keys and `RPC_CALL_DURATION_BUCKETS` are now exported from the `/conventions` entrypoint, and `statusCodeToString()` from the new `/util` entrypoint. Previously the AppView imported these from `@atproto/bsync`, which made a whole service package a runtime dependency of another just to agree on a metric label.

### Patch Changes

- [#5475](https://github.com/bluesky-social/atproto/pull/5475) [`46fdec9`](https://github.com/bluesky-social/atproto/commit/46fdec90d4eca8c8d7c8eeb7dc801cf52ffaaed6) Thanks [@rafaeleyng](https://github.com/rafaeleyng)! - Drop the `@connectrpc/connect` dependency: `statusCodeToString()` now takes a plain `number` and resolves the status name through a hand-rolled map of the Connect `Code` enum values. Importing the library here would load it before it gets instrumented, breaking the instrumentation.

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
