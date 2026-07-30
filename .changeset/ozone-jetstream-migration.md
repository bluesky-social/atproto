---
'@atproto/ozone': patch
---

Migrate the internal Jetstream client to `@atproto/ws-client`. `Jetstream.close()` now resolves once the stream has fully stopped rather than returning immediately.
