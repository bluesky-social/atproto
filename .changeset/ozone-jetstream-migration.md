---
'@atproto/ozone': patch
---

Migrate the internal Jetstream client off the removed `WebSocketKeepAlive` to `@atproto/ws-client`'s `websocket()` generator. `Jetstream.close()` now resolves once the stream has actually unwound rather than returning immediately, so callers that tear down dependencies after awaiting it (as the verification listener does) no longer race a still-running stream.
