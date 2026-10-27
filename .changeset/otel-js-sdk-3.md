---
"@atproto-labs/opentelemetry-node": minor
"@atproto/bsky": patch
"@atproto/bsync": patch
"@atproto/ozone": patch
"@atproto/pds": patch
---

Update to OpenTelemetry JS SDK 3.x (`@opentelemetry/api` 1.10). Event log records are now emitted through `@opentelemetry/api` (`@opentelemetry/api-logs` was removed upstream). The HTTP instrumentation only reports the stable `http.server.request.duration` and `http.client.request.duration` metrics: the legacy `http.server.duration` and `http.client.duration` metrics are gone, and `OTEL_SEMCONV_STABILITY_OPT_IN=http` no longer has any effect.
