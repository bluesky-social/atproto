# OTLP traces for packages/bsky (AppView), following PR 4805's PDS pattern

## Context

PR 4805 (`msi/pds-otel`, fetched locally as FETCH_HEAD) replaced the Datadog-specific `dd-trace` tracer in the PDS image with the vendor-neutral OpenTelemetry NodeSDK, loaded via `node --import=@atproto/pds/telemetry` and configured through conventional `OTEL_*` env vars (or `OTEL_CONFIG_FILE`). This task applies the same pattern to the bsky AppView: delete `services/bsky/tracer.ts` (dd-trace) and add an `@atproto/bsky/telemetry` entry point.

Decisions:
- **Dataplane tracing**: OTel's `HttpInstrumentation` does not cover `node:http2`, which is what connect-rpc's gRPC transport uses — a straight port would silently drop all dataplane spans (today dd-trace monkey-patches these into a `dataplane-bsky` service). We write a **hand-rolled connect `Interceptor`** built only on `@opentelemetry/api` (no-op when no SDK registered).
- **Branch**: independent, off `main`, on the current `appview-traces` branch. Do NOT stack on `msi/pds-otel`; do NOT replicate its Dockerfile COPY restructure (minor CMD conflict to resolve whenever 4805 merges).
- Traces only — no `metrics.ts` starter metric in this PR.

## Changes

### 1. `packages/bsky/src/telemetry.ts` (new)

Copy `git show FETCH_HEAD:packages/pds/src/telemetry.ts` nearly verbatim, including the `extractNormalizedXrpcEndpoint` hot-path helper and the `startNodeSDKClass` wrapper (copied, not shared — no shared-package churn). Same skeleton: `OTEL_SDK_DISABLED` gate, `register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)`, `OTEL_CONFIG_FILE` → `startNodeSDK` else `startNodeSDKClass`, `getResourceDetectors()`, SIGTERM/SIGINT/beforeExit shutdown. Only the instrumentations array differs:

```ts
instrumentations: [
  new RuntimeNodeInstrumentation(),
  new HttpInstrumentation({ requestHook: /* XRPC ATTR_HTTP_ROUTE, verbatim from pds */ }),
  new ExpressInstrumentation(),
  new UndiciInstrumentation({ requestHook: /* XRPC, verbatim from pds */ }),
  new IORedisInstrumentation(),
  new PgInstrumentation(),
  new PinoInstrumentation(),
],
```

- **Dropped vs PDS**: `AwsInstrumentation` (packages/bsky has no @aws-sdk dep), `BetterSqlite3Instrumentation` (PDS-only).
- **Added**: `PgInstrumentation` — packages/bsky ships the pg-backed dataplane server; no-op in the AppView runtime where pg is never loaded. Flag in PR description that dropping it is fine if reviewers object.
- Not imported from `src/index.ts` — separate side-effect entrypoint; `tsgo` build emits `dist/telemetry.js`.

### 2. `packages/bsky/src/otel.ts` (new) — connect-rpc client tracing interceptor

Factory `tracingInterceptor(opts?: { rpcSystem?: 'grpc' | 'connect_rpc'; peerService?: string })` returning a connect v1 `Interceptor`. Depends only on `@opentelemetry/api` + `@connectrpc/connect` (semconv attr names inlined as string constants):

- Span `${req.service.typeName}/${req.method.name}` (e.g. `bsky.Service/GetPostThread`), `SpanKind.CLIENT`.
- Attrs: `rpc.system` (default `'connect_rpc'`), `rpc.service` = `req.service.typeName`, `rpc.method` = `req.method.name`, `server.address`/`server.port` parsed from `req.url`, optional `peer.service`.
- `propagation.inject(ctx, req.header, headersSetter)` — traceparent to the server; harmless if unconsumed.
- Runs `next(req)` inside `context.with(ctx, …)`; on `ConnectError` sets `rpc.grpc.status_code` (grpc mode, numeric) or `rpc.connect_rpc.error_code` (snake_case code name) + span status ERROR; rethrows; `span.end()` in `finally`. All 115 dataplane RPCs are unary (verified); streams would merely end the span at response start, never crash.
- No-op safety: `trace.getTracer` returns a ProxyTracer producing non-recording spans when no SDK is registered — zero behavior change for library consumers/tests.
- Retry note: the dataplane retry loop (`makeAnyClient` in `createDataPlaneClient`) sits above the transport, so each attempt gets its own span — desirable.

Wiring (inside the factories, so dev-env/tests/embedders get spans automatically; caller-supplied auth interceptors in `src/index.ts` untouched):
- `packages/bsky/src/data-plane/client/index.ts` `createBaseClient`: `interceptors: [callerInterceptor('appview'), tracingInterceptor({ rpcSystem: 'grpc', peerService: 'dataplane-bsky' })]`
- `packages/bsky/src/bsync.ts` `createBsyncClient`: spread `opts.interceptors`, append `tracingInterceptor({ peerService: 'bsync' })`
- `packages/bsky/src/courier.ts`: same, `peerService: 'courier'`
- `packages/bsky/src/rolodex.ts`: same, `peerService: 'rolodex'`

(Connect applies the last array element outermost, so the tracing span wraps the header-setting interceptors.)

### 3. `packages/bsky/package.json`

- Exports: add `"./telemetry"` → `./dist/telemetry.{js,d.ts}` and `"./package.json"` (mirrors PDS).
- Add deps (PDS PR versions): `@opentelemetry/api ^1.9.1`, `auto-instrumentations-node ^0.77.0`, `instrumentation ^0.219.0`, `instrumentation-express ^0.67.0`, `instrumentation-http ^0.219.0`, `instrumentation-ioredis ^0.67.0`, `instrumentation-pino ^0.65.0`, `instrumentation-runtime-node ^0.32.0`, `instrumentation-undici ^0.29.0`, `resource-detector-container ^0.8.10`, `sdk-node ^0.219.0`, `semantic-conventions ^1.41.1`; plus `instrumentation-pg` — take the exact range from `npm view @opentelemetry/auto-instrumentations-node@0.77.0 dependencies` (same contrib release; currently 0.72.x).
- No new devDep for tests: reuse `@opentelemetry/sdk-node`'s `tracing` re-export (`BasicTracerProvider`, `SimpleSpanProcessor`, `InMemorySpanExporter`).

### 4. `services/bsky/`

- Delete `tracer.ts`.
- `package.json`: remove `dd-trace ^5.103.0`; add `@opentelemetry/instrumentation ^0.219.0` (mirrors PR 4805's services/pds — hook.mjs must resolve from the service dir under the hoisted prod install).
- `Dockerfile` (minimal): CMD → `["node", "--heapsnapshot-signal=SIGUSR2", "--enable-source-maps", "--import=@atproto/bsky/telemetry", "api.ts"]`; add label `social.bsky.appview.telemetry="otel"` with the same "distinguish pre-otel builds" comment as PDS.

### 5. Changeset

`pnpm changeset` → `'@atproto/bsky': patch` — "Add OpenTelemetry tracing: `@atproto/bsky/telemetry` entrypoint for `node --import`, plus client tracing spans for dataplane/bsync/courier/rolodex connect-rpc calls." (PR 4805 used patch; services/bsky is private, no changeset.)

### 6. Test — `packages/bsky/src/otel.test.ts` (vitest, colocated)

- In-memory tracer via sdk-node's `tracing` re-export + `W3CTraceContextPropagator`; set/reset globals in beforeAll/afterAll.
- Fake `UnaryRequest` (`stream: false`, `service.typeName: 'bsky.Service'`, `method.name: 'GetPostThread'`, url, `header: new Headers()`).
- Assert: success → one ended CLIENT span with correct name/attrs and injected `traceparent` header; ConnectError(Unavailable) → status ERROR, `rpc.grpc.status_code === 14` (grpc mode) / `'unavailable'` (connect mode), error rethrown; globals reset → interceptor passes through as pure no-op.

## Verification

1. `pnpm install` at root (lockfile).
2. `cd packages/bsky && pnpm build` — confirm `dist/telemetry.js` + `.d.ts` emitted.
3. `cd packages/bsky && pnpm test -- src/otel.test.ts`, then full `pnpm test` (whole suite exercises the interceptor's no-op path).
4. Manual smoke: from `services/bsky` with dev-env running, `OTEL_TRACES_EXPORTER=console OTEL_METRICS_EXPORTER=none OTEL_LOGS_EXPORTER=none node --import=@atproto/bsky/telemetry api.ts`; hit `/xrpc/app.bsky.actor.getProfile` → expect server span with `http.route=/xrpc/app.bsky.actor.getProfile` and child CLIENT spans `bsky.Service/…` with `peer.service=dataplane-bsky`.
5. `OTEL_SDK_DISABLED=true` run → clean boot, no spans.
6. `docker build -f services/bsky/Dockerfile .` to confirm `--import=@atproto/bsky/telemetry` resolves in the hoisted prod install.
7. `grep -rn dd-trace services/bsky packages/bsky` → empty; lint/format touched files from `packages/bsky`.

## Risks / notes

- Datadog dashboards keyed on the old `service.name=dataplane-bsky` / `resource.name` conventions need updating — deployment concern, out of scope (same as PR 4805).
- pnpm-workspace.yaml's `opentelemetry-plugin-better-sqlite3>@opentelemetry/core` override is PDS-only; no workspace-yaml change needed here.
- Express instrumentation + the HTTP requestHook reproduce the old `maintainXrpcResource` naming (server span → `METHOD /xrpc/<nsid>` via `ATTR_HTTP_ROUTE`), identical to the PDS approach.
