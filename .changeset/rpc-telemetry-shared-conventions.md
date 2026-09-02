---
'@atproto-labs/opentelemetry-node': minor
'@atproto/bsky': patch
'@atproto/bsync': patch
---

Move the RPC telemetry constants shared by both halves of a bsync call into `@atproto-labs/opentelemetry-node`: the `bsync.namespace` and `bsync.operation` attribute keys and `RPC_CALL_DURATION_BUCKETS` are now exported from the `/conventions` entrypoint, and `statusCodeToString()` from the new `/util` entrypoint. Previously the AppView imported these from `@atproto/bsync`, which made a whole service package a runtime dependency of another just to agree on a metric label.
