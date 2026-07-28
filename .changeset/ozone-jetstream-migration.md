---
'@atproto/ozone': patch
---

Migrate the internal Jetstream client off the removed `WebSocketKeepAlive` to `@atproto/ws-client`'s `websocket()` generator. No change to Jetstream's public behavior.
