---
"@atproto-labs/opentelemetry-node": minor
"@atproto/bsky": patch
"@atproto/bsync": patch
"@atproto/ozone": patch
"@atproto/pds": patch
---

Update to OpenTelemetry JS SDK 3.x (`@opentelemetry/api` 1.10), which requires Node.js `>=22.15.0`. Event log records are now emitted through `@opentelemetry/api` (`@opentelemetry/api-logs` was removed upstream). The HTTP instrumentation only reports the stable `http.server.request.duration` and `http.client.request.duration` metrics: the legacy `http.server.duration` and `http.client.duration` metrics are gone, and `OTEL_SEMCONV_STABILITY_OPT_IN=http` no longer has any effect. Instrumentations passed to `setup()` now also instrument modules loaded through ESM imports, not only `require()`d ones, when built on the same `@opentelemetry/instrumentation` as `@atproto-labs/opentelemetry-node`; otherwise `setup()` now throws an `InstrumentationMismatchError` instead of silently missing them. The new `@atproto-labs/opentelemetry-node/better-sqlite3-plugin` export, a port of `opentelemetry-plugin-better-sqlite3` producing identical spans, replaces that package in the PDS.
