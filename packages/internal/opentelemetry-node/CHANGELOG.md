# @atproto-labs/opentelemetry-node

## 0.7.0

### Minor Changes

- [#6051](https://github.com/bluesky-social/atproto/pull/6051) [`88bf64a`](https://github.com/bluesky-social/atproto/commit/88bf64a4372741a93f894afd06915eb504e6931e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Drop the `@opentelemetry/auto-instrumentations-node` dependency. Resource detection now only uses `@opentelemetry/sdk-node`'s local detectors plus the `container` one, so the cloud provider detectors (`alibaba`, `aws`, `azure`, `gcp`) no longer probe metadata endpoints at startup, and `OTEL_NODE_RESOURCE_DETECTORS` ignores their names with a warning.

## 0.6.0

### Minor Changes

- [#5952](https://github.com/bluesky-social/atproto/pull/5952) [`67fc7db`](https://github.com/bluesky-social/atproto/commit/67fc7db6e644fe32880335c404195b31d3840acf) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Register the import-in-the-middle ESM loader hook in-thread with `module.registerHooks()` instead of the deprecated `module.register()` (DEP0205), and update `@opentelemetry/*` dependencies. `@atproto-labs/opentelemetry-node`, and the services that load it, now require Node.js `^22.22.3 || ^24.11.1 || >=25.1.0`.

## 0.5.1

### Patch Changes

- [#5950](https://github.com/bluesky-social/atproto/pull/5950) [`b9b1ca7`](https://github.com/bluesky-social/atproto/commit/b9b1ca7f176b93d12e39685799c5f2e1f9a63be7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update `vitest` to v5, `vite` to v8.3.8 and `rolldown` to v1.3.3 (dev dependencies)

## 0.5.0

### Minor Changes

- [#5746](https://github.com/bluesky-social/atproto/pull/5746) [`1c8c3a3`](https://github.com/bluesky-social/atproto/commit/1c8c3a3a8ea27a060f38cda71172339aa1728113) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `extractUrlXrpcMethodName` and `UNKNOWN_XRPC_ROUTE` from public interface

- [#5746](https://github.com/bluesky-social/atproto/pull/5746) [`1c8c3a3`](https://github.com/bluesky-social/atproto/commit/1c8c3a3a8ea27a060f38cda71172339aa1728113) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update to OpenTelemetry JS SDK 3.x (`@opentelemetry/api` 1.10), which requires Node.js `>=22.15.0`. Event log records are now emitted through `@opentelemetry/api` (`@opentelemetry/api-logs` was removed upstream). The HTTP instrumentation only reports the stable `http.server.request.duration` and `http.client.request.duration` metrics: the legacy `http.server.duration` and `http.client.duration` metrics are gone, and `OTEL_SEMCONV_STABILITY_OPT_IN=http` no longer has any effect. Instrumentations passed to `setup()` now also instrument modules loaded through ESM imports, not only `require()`d ones, when built on the same `@opentelemetry/instrumentation` as `@atproto-labs/opentelemetry-node`; otherwise `setup()` now throws an `InstrumentationMismatchError` instead of silently missing them. The new `@atproto-labs/opentelemetry-node/better-sqlite3-plugin` export, a port of `opentelemetry-plugin-better-sqlite3` producing identical spans, replaces that package in the PDS.

- [#5746](https://github.com/bluesky-social/atproto/pull/5746) [`1c8c3a3`](https://github.com/bluesky-social/atproto/commit/1c8c3a3a8ea27a060f38cda71172339aa1728113) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove `./instrumentation` export point

## 0.4.0

### Minor Changes

- [#5671](https://github.com/bluesky-social/atproto/pull/5671) [`2720f72`](https://github.com/bluesky-social/atproto/commit/2720f72a5c4118c22841861dbc92a20693140093) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Disable context propagation by default

## 0.3.1

### Patch Changes

- [#5608](https://github.com/bluesky-social/atproto/pull/5608) [`a044af7`](https://github.com/bluesky-social/atproto/commit/a044af7bd7b522ca51229d7686f5b6413be6eee7) Thanks [@blackmichael](https://github.com/blackmichael)! - Make the `xrpcMethods` option truly opt-in. When omitted, the `http.route` attribute of the HTTP server metrics is left as set by the Express instrumentation, instead of reporting every XRPC request as `/xrpc/{unknown}`.

## 0.3.0

### Minor Changes

- [#5565](https://github.com/bluesky-social/atproto/pull/5565) [`0593d81`](https://github.com/bluesky-social/atproto/commit/0593d818bc2b7f8a40c9d0fe036bf39c7a4eecda) Thanks [@jcalabro](https://github.com/jcalabro)! - Add an `xrpcMethods` option to `setup()` (and `getDefaultAtprotoInstrumentations()`) that puts the XRPC method on the `http.route` attribute of the HTTP server duration metric. Until now the XRPC-aware route was only applied to spans: metrics got whatever route the Express instrumentation last saw, which for catchall handlers is `/` or nothing at all. Methods not in the list are grouped under `/xrpc/{unknown}` to keep the attribute low-cardinality.
  
  Also fix XRPC span naming and the `xrpc.method` / `xrpc.proxied` / `xrpc.proxy` span attributes on Express servers: Express gives incoming requests a `path` getter, which made them look like outgoing requests to the span hook, so it threw (silently) and never applied.

## 0.2.1

### Patch Changes

- [#5477](https://github.com/bluesky-social/atproto/pull/5477) [`0287dce`](https://github.com/bluesky-social/atproto/commit/0287dcece76c2c2453406cb3b51591ce0f983a98) Thanks [@foysalit](https://github.com/foysalit)! - Align Ozone telemetry with the shared OpenTelemetry bootstrap and add Undici tracing while retaining PostgreSQL instrumentation. Restrict the shared ESM loader hook to instrumented modules.

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
