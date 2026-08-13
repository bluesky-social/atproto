---
'@atproto/opentelemetry-node': minor
'@atproto/pds': patch
---

Extract the OpenTelemetry Node bootstrap out of the PDS into a new
`@atproto/opentelemetry-node` package. It exposes a `setup()` function and an
`extractNormalizedLxm()` helper, plus a `@atproto/opentelemetry-node/conventions`
entrypoint re-exporting `@opentelemetry/semantic-conventions` alongside the
atproto XRPC attribute keys.
