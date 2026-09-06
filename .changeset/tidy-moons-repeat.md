---
'@atproto-labs/xrpc-utils': patch
---

Drop the `@atproto/xrpc` dependency by importing `ResponseType` from `@atproto/xrpc-server`, which re-exports it. No behavior change.
