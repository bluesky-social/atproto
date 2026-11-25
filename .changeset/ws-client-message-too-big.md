---
'@atproto/ws-client': patch
---

On Node.js, a message over the payload limit fails the connection with a non-retryable `MessageTooBigError` and a `1009` close, rather than a retryable `SocketError`, so under the default reconnect policy the stream ends instead of reconnecting.
